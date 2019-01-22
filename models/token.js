const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let tokenSchema = new Schema({
    accountSid: String,
    authToken: String
});

module.exports = mongoose.model('token', tokenSchema);