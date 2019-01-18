const express = require('express');
const router = express.Router;
const User = require('../models/user.js');

router.post('/sign-up', (req, res) => {
    if (req.body.password !== req.body.passwordCheck) {
        console.log('Sign Up: PW and Retype PW is different');
        return res.json({result: 0});
    }

    // 있는 아이디면 오류
    User.findOne({id: req.body.phoneNumber}, (err, user) => {
        if (err) {
            console.log(err);
            return res.json({result: 0});
        }

        else if (user !== null) {
            console.log('Sign Up: ID already exists');
            return res.json({result: 0});
        }
        else {

            const newuser = new User();
            newuser.phoneNumber = req.body.phoneNumber;
            newuser.password = req.body.password;
            newuser.company = req.body.company;
            newuser.account = req.body.account;
        
            newuser.save(err => {
                if (err) {
                    console.log(err);
                    return res.json({result: 0});
                }
                console.log('Sign up: Good database created');
                return res.json({result: 1});
            });
        }
    });
});

module.exports = router;