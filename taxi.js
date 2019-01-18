const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cookieParser = require('cookie-parser');
const session = require('express-session');
const crypto = require('crypto');


const User = require('./models/user.js');
// const router = require('./routes')(app, User);

app.use(session({
    key: 'sid',
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000*60*60*24
    }
}));
app.use(passport.initialize());
app.use(passport.session());
// passportConfig();


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
app.use(cookieParser());


/* parsing */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));


/* passport related setting */
passport.serializeUser((user, done) => { // Strategy 성공 시 호출됨
    done(null, user._id);       // 여기의 user가 deserializeUser의 첫 번째 매개변수로 이동
});

passport.deserializeUser((id, done) => {      // 매개변수 user는 serializeUser의 done의 인자 user를 받은 것
    User.findById(id, (err, user) => {
        done(null, user);       // 여기의 user가 req.user가 됨
    });
});

passport.use(new LocalStrategy({ // local 전략을 세움
    usernameField: 'phoneNumber',
    passwordField: 'password',
    session: true, // 세션에 저장 여부
    passReqToCallback: true,
}, (req, phoneNumber, password, done) => {
    // phoneNumber 를 -가 들어간 형태로도 작동하게 할까?
    User.findOne({phoneNumber: phoneNumber}, (err, user) => {
        if (err) {
            console.log("Log In Error: " + err);
            return res.json({result: 0});
        }

        // 해당하는 전화번호가 없는 경우
        else if (user === null) {
            console.log('Log In: ID does not exist');
            return done('등록된 사용자가 아닙니다.', false);
        }
        else {
            // let saltBuf = new Buffer(user.salt, 'base64');
            // console.log(saltBuf);
            crypto.pbkdf2(req.body.password, user.salt, 48580, 64, 'sha512', (err, key) => {
                if ( (key.toString('base64')) === user.password) {
                    /* 뭔가 세션에 관한 것들 */
                    // res.cookie("user", user._id, {
                    //     expires: new Date(Date.now() + 1000*60*60*24)
                    // });
                    // req.session.id = user._id;
                    console.log('Log in: log in success');
                    done(null, user)
                }
                else {
                    return done(null, false, {message: '잘못된 phonenum 또는 password 입니다'});
                }
            });
        }
    });

    // User.findOne({ phoneNumber: phoneNumber }, (err, user) => {
    //     if (err) return done(err); // 서버 에러 처리
    //     if (!user) return done(null, false, { message: '존재하지 않는 아이디입니다' }); // 임의 에러 처리
    //     return user.comparePassword(password, (passError, isMatch) => {
    //         if (isMatch) {
    //             return done(null, user); // 검증 성공
    //         }
    //         return done(null, false, { message: '비밀번호가 틀렸습니다' }); // 임의 에러 처리
    //     });
    // });
}));


/* Routing */
app.post('/sign-up', (req, res) => {
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

            /* 비밀번호 암호화 */
            crypto.randomBytes(64, (err, buf) => {
                crypto.pbkdf2(req.body.password, buf.toString('base64'), 48580, 64, 'sha512', (err, key) => {
                    console.log(buf);
                    newuser.password = key.toString('base64');
                    newuser.salt = buf.toString('base64');

                    newuser.phoneNumber = req.body.phoneNumber;
                    newuser.company = req.body.company;
                    newuser.account = req.body.account;
                    console.log(newuser);
                
                    newuser.save(err => {
                        if (err) {
                            console.log(err);
                            return res.json({result: 0});
                        }
                        console.log('Sign up: Good database created');
                        return res.json({result: 1});
                    });
                });
            });
        }
    });
});

app.post('/log-in', (req, res) => {
    passport.authenticate("local", (err, user, info) => {
        if (err) console.log('Log in error: '+ err);
        if (!user) {
            console.log("Error 400");
            return res.status(400).send([user, "Cannot log in", info]);
        }
        req.login(user, (err) => {
            console.log("Log in Success");
            return res.json({result: 1});
        });
    })(req, res);

    // // phoneNumber 를 -가 들어간 형태로도 작동하게 할까?
    // User.findOne({phoneNumber: req.body.phoneNumber}, (err, user) => {
    //     if (err) {
    //         console.log("Log In Error: " + err);
    //         return res.json({result: 0});
    //     }

    //     // 해당하는 전화번호가 없는 경우
    //     else if (user === null) {
    //         console.log('Log In: ID does not exist');
    //         return res.json({result: 0});
    //     }
    //     else {
    //         // let saltBuf = new Buffer(user.salt, 'base64');
    //         // console.log(saltBuf);
    //         crypto.pbkdf2(req.body.password, user.salt, 48580, 64, 'sha512', (err, key) => {
    //             if ( (key.toString('base64')) === user.password) {
    //                 /* 뭔가 세션에 관한 것들 */
    //                 res.cookie("user", user._id, {
    //                     expires: new Date(Date.now() + 1000*60*60*24)
    //                 });
    //                 req.session.id = user._id;
    //                 console.log('Log in: log in success');
    //                 // return res.json({result: 1});
    //             }
    //             else {
    //                 console.log(key.toString('base64'));
    //                 return res.json({result: 0});
    //             }
    //         });
    //     }
    // });
});


/* open the server */
const server = app.listen(80, () => {
    console.log('Server is running at port 2080');
});