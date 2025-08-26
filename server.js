const express = require('express');
const app = express();
require('dotenv').config();
require('./config/db');
const path=require('path');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

const userRoutes = require('./api/user');
app.use('/', userRoutes);
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.listen(process.env.PORT, () => {
    console.log(`Server running on http://localhost:${process.env.PORT}`);
});
