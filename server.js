import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import http from "http";
import pkg from 'mssql';
const { ConnectionPool } = pkg;

const app = express();
const port = 3000;
app.use(cors());
app.use(bodyParser.json());

// Configure MSSQL connection
const config = {
    user: 'lynk',
    password: 'Walker99',
    server: 'lynk-to.database.windows.net',
    database: 'Lynk-To',
    options: {
        encrypt: true
    }
};

// Create MSSQL connection pool
const pool = new ConnectionPool(config);

// Function to handle MSSQL errors
function handleMSSQLError(error, res) {
    console.error('MSSQL Error:', error);
    res.status(500).json({ error: 'Database error' });
}

// Connect to MSSQL database
pool.connect().then(() => {
    console.log('Connected to MSSQL database');
}).catch(error => {
    console.error('Error connecting to MSSQL database:', error);
});

// Create routes
app.post('/create_user', async (req, res) => {
    console.log("in the create user");
    console.log("req.body", req.body);
    const { rollno, username, password } = req.body;

    try {
        const poolRequest = await pool.request();
        const result = await poolRequest.query('INSERT INTO users (user_id, username, password) VALUES (@rollno, @username, @password)', {
            rollno,
            username,
            password
        });
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        handleMSSQLError(error, res);
    }
});

app.post('/login', async (req, res) => {
    console.log("in the login");
    console.log("req.body", req.body);
    const { rollno, password } = req.body;

    try {
        const poolRequest = await pool.request();
        const result = await poolRequest.query('SELECT * FROM users WHERE user_id = @rollno AND password = @password', {
            rollno,
            password
        });
        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Invalid user_id or password' });
        }
        res.json({ message: 'Login successful' });
    } catch (error) {
        handleMSSQLError(error, res);
    }
});

app.get('/', (req, res) => { 
    res.send('Hello, Azure! This is a Node.js application.'); 
  }); 

app.get('/messages', async (req, res) => {
    console.log("in the messages");
    try {
        const poolRequest = await pool.request();
        const result = await poolRequest.query('SELECT * FROM messages');
        console.log('Messages fetched successfully:', result.recordset);
        res.json(result.recordset);
    } catch (error) {
        handleMSSQLError(error, res);
    }
});

app.post('/post_message', async (req, res) => {
    const { rollno, message, timestamp } = req.body;

    if (!rollno || !message || !timestamp) {
        return res.status(422).json({ error: "Please provide rollno, message, and timestamp." });
    }

    try {
        const poolRequest = await pool.request();
        const result = await poolRequest.query('INSERT INTO messages (rollno, message, timestamp) VALUES (@rollno, @message, @timestamp)', {
            rollno,
            message,
            timestamp
        });
        console.log('Message has been inserted');
        res.status(201).json({ message: 'Message posted successfully' });
    } catch (error) {
        handleMSSQLError(error, res);
    }
});

app.get('/events', async (req, res) => {
    console.log("in the events");
    const { event_date, user_id } = req.query;

    if (!event_date || !user_id) {
        return res.status(400).json({ error: 'Both event_date and user_id parameters are required.' });
    }

    try {
        const poolRequest = await pool.request();
        const result = await poolRequest.query(`
            SELECT s.subject_name, e.event_type, e.event_time
            FROM events e
            JOIN registrations r ON e.subject_code = r.subject_id
            JOIN subjects s ON e.subject_code = s.subject_code
            WHERE r.user_id = @user_id
            AND e.event_date = @event_date;
        `, {
            user_id,
            event_date
        });
        res.json(result.recordset);
    } catch (error) {
        handleMSSQLError(error, res);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

app.post('/script', async (req, res) => {
    const { message } = req.body;

    // Validate the incoming data
    if (!message) {
        return res.status(422).json({ error: 'Please provide a message.' });
    }

    // Construct the data to be sent in the POST request
    const postData = JSON.stringify({
        query: message // Modify this with the actual query you want to send
    });

    // Define the options for the HTTP POST request
    const options = {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/query',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length
        }
    };

    // Create the HTTP request object
    const httpRequest = http.request(options, (httpResponse) => {
        let data = '';
        httpResponse.on('data', (chunk) => {
            data += chunk;
        });
        httpResponse.on('end', () => {
            console.log('Query sent successfully:', data);
            res.status(201).json({ message: 'Message posted successfully' });
        });
    });

    // Handle errors
    httpRequest.on('error', (error) => {
        console.error('Error sending query:', error);
        res.status(500).json({ error: 'Error sending query' });
    });

    // Write the data to the request body
    httpRequest.write(postData);
    httpRequest.end();
});
