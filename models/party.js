const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let partySchema = new Schema({
    title: String,
    departure: String,
    destination: String,
    date: String,
    numLeft: Number,
    explanation: String
});

module.exports = mongoose.model('party', partySchema);