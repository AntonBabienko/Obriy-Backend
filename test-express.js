const express = require('express');
const app = express();

app.get('/test', (req, res) => {
    res.json({ message: 'It works!' });
});

app.listen(3000, () => {
    console.log('Test server on port 3000');
});
