const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let twilioTokenSchema = new Schema({
    accountSid: String,
    authToken: String
});

module.exports = mongoose.model('twilioToken', twilioTokenSchema);