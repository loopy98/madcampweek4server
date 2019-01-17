const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');


/* DB connection setting */
const db = mongoose.connection;
db.on('error', console.error);
db.once('open', () => {
    console.log('DB connection good.');
});
mongoose.connect("mongodb://localhost:27017/taxi", {useNewUrlParser: true});


/* Middleware Setting */
app.use(express.static( 'public/views'));
app.set('views', __dirname + '/homepage/');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);


/* parsing */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));