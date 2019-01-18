const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let userSchema = new Schema({
    phoneNumber: Number,
    password: String,
    company: String,
    account: String,
    salt: String
});

module.exports = mongoose.model('user', userSchema);