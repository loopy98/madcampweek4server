const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const mongodb = require('mongodb');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const cookieParser = require('cookie-parser');
const session = require('express-session');
const crypto = require('crypto');
const fs = require('fs');
const twilio = require('twilio');

const User = require('./models/user.js');
const Party = require('./models/party.js');
const Token = require('./models/token.js');
// const router = require('./routes')(app, User);

// socket 에서 사용자의 닉네임을 정해준다.
let annonymous = 0;
const annonymousList = ['악어', '개미핥기', '아르마딜로', '오소리', '박쥐', '비버', '버팔로', '낙타', '카멜레온', '치타', '다람쥐', '친칠라', '가마우지', '코요테', '까마귀'
                    , '공룡', '돌고래', '오리', '코끼리', '여우', '흰 족제비', '개구리', '기린', '회색 곰', '고슴도치', '하마', '하이에나'];


/* open the server */
const server = app.listen(80, () => {
    console.log('Server is running at port 2080');
});
const io = require('socket.io')(server);

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


/* DB connection setting */
const MongoClient = mongodb.MongoClient;
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

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    next();
});


/* Routing */
app.get('/', (req, res) => {
    res.end('Hello World!');
});

app.get('/party-list', (req, res) => {
    Party.find({}, (err, party) => {
        if (err) {
            console.log(err);
            return res.json('0');
        }
        if (party.length === 0) {
            // 먼가 예외처리
            console.log("New Party: There are no party detected.");
            return;
        }
        res.send(party);
        console.log('Party list sended.');
    });
});

// 현재 접속중인 유저가 누군지 알고 싶을 때
app.get('/current-user', (req, res) => {
    return res.send(req.user);
});

app.post('/current-taxi-party', (req, res) => {
    User.findOne({"phoneNumber": req.body.phoneNumber}, (err, user) => {
        if (err) console.log(err);
        return res.send(user.currentTaxiParty);
    });
});

app.post('/send-message', (req, res) => {
    console.log(req.body.currentTaxiParty);

    Token.findOne({}, (err, token) => {
        if (err) {
            console.log(err);
            return res.send('0');
        }
        console.log(token);
        let client = twilio(token.accountSid, token.authToken);

        User.find({"currentTaxiParty": req.body.currentTaxiParty}, (err, user) => {
            if (err) {
                console.log(err);
                return res.send('0');
            }

            let content = "택시 팟이 구성되었습니다. 택시 팟에 있는 사람들의 전화번호는, ";
            for (let i=0; i < user.length; i++) {
                let temp = "0" + user[i].phoneNumber + " ";
                content += temp;
            }
            content += "입니다.";

            for (let i=0; i < user.length; i++) {
                client.messages
                .create({
                    body: content,
                    from: '+12673824780',
                    to: "+82" + user[i].phoneNumber
                })
                .then(message => {
                    console.log(message.sid);
                    res.send("1");
                })
                .done();
            }
        });
    });
});

app.post('/sign-up', (req, res) => {
    // 있는 아이디면 오류
    User.findOne({"phoneNumber": req.body.phoneNumber}, (err, user) => {
        if (err) {
            console.log(err);
            return res.json('0');
        }

        else if (user !== null) {
            console.log('Sign Up: ID already exists');
            return res.json('2');
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
                    newuser.currentTaxiParty = "none";
                    console.log(newuser);
                
                    newuser.save(err => {
                        if (err) {
                            console.log(err);
                            return res.json('0');
                        }
                        console.log('Sign up: Good database created');
                        return res.json('1');
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
            return res.send("Cannot log in");
        }
        req.login(user, (err) => {
            return res.send(user);
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

app.post('/new-party', (req, res) => {
    console.log("new party signal is entered");
    let newParty = new Party;
    newParty.title = req.body.title;
    newParty.departure = req.body.departure;
    newParty.destination = req.body.destination;
    newParty.date = req.body.date;
    newParty.numLeft = req.body.numLeft;
    newParty.explanation = req.body.explanation;
    console.log("New Party: " + newParty);

    newParty.save((err) => {
        if (err) {
            console.log("New Party Error: " + err);
            return res.json('0');
        }
        console.log("New Party: good database created");
        res.json('1');
    });
});

app.put('/enter-party', (req, res) => {
    User.findOne({"phoneNumber": req.body.phoneNumber}, (err, user) => {
        if (user.currentTaxiParty !== "none") {
            if (user.currentTaxiParty === req.body.currentTaxiParty) return res.send('0');
            else {
                Party.findOne({"_id": req.body.currentTaxiParty}, (err, party) => {
                    if (err) console.log(err);
                    else if (!party) return res.json({error: 'party not found'});
                    else {
                        let numLeft = party.numLeft;
                        if (numLeft <= 0) {
                            console.log('Selected party is full');
                            return res.json('0');
                        }
                        else {
                            party.numLeft = numLeft - 1;
                            party.save((err) => {
                                if (err) console.log(err);
                                // res.json('party info updated');
                            });
                        }
                    }
                });

                Party.findOne({"_id": user.currentTaxiParty}, (err, party) => {
                    if (err) console.log(err);
                    if (!party) return res.send("party not found");
                    else {
                        let numLeft = party.numLeft;
                        if (numLeft >= 4) {
                            console.log("empty party");
                            return res.send('0');
                        }
                        else {
                            party.numLeft = numLeft + 1;
                            party.save((err) => {
                                if (err) console.log(err);
                            });
                        }
                    }
                });
            }
        }
        else {
            Party.findOne({"_id": req.body.currentTaxiParty}, (err, party) => {
                if (err) console.log(err);
                else if (!party) return res.json({error: 'party not found'});
                else {
                    let numLeft = party.numLeft;
                    if (numLeft <= 0) {
                        console.log('Selected party is full');
                        return res.json('0');
                    }
                    else {
                        party.numLeft = numLeft - 1;
                        party.save((err) => {
                            if (err) console.log(err);
                            // res.json('party info updated');
                        });
                    }
                }
            });
        }

        if (err) console.log(err);
        if(!user) return res.json({ error: 'user not found' });
        else {
            user.currentTaxiParty = req.body.currentTaxiParty;
            user.save((err) => {
                if (err) console.log(err);
                console.log('User and party info updated');
                res.send('1');
            });
        }
    });
});

let url = 'mongodb://localhost:27017';
MongoClient.connect(url,{useNewUrlParser: true}, (err, client) => {
    if (err)
        console.log('Unable to connect to the mongoDB server.Error', err);
    else{
        io.on('connection', (socket) => {
            console.log('Client Connection');

            // 유저가 채팅방에 들어왔을 때
            socket.on('join', (userNickname, chatroomid) => {
                socket.join(chatroomid);
                
                // 이전의 채팅 기록을 불러와서 보여준다.
                let db = client.db('taxi');
                db.collection('ChatRoom').find({"chatroomid": chatroomid}).sort({_id:1}).toArray((err, res) => {
                    var i = 0;
                    socket.to(chatroomid).emit('loading_start');
                    while (i < res.length) {
                        let message = {"message": res[i].message, "nickname": res[i].nickname, "phoneNumber": res[i].phoneNumber, "chatroomid": res[i].chatroomid};
                        setTimeout(() => {socket.to(chatroomid).emit('load', message);},200);
                        i++;
                    }
                    console.log("Message loading has finished.");
                    setTimeout(() => {socket.to(chatroomid).emit('loading_end');},200*(res.length)+10);
                });
                db.collection('ChatRoom').find({"nickname": userNickname}, (err, user) => {
                    // 만약 최초로 채팅방에 들어온 유저라면 접속 메세지를 띄워준다
                    if (user.length === 0) {
                        let insertJson = {
                            'phoneNumber' : phoneNumber,
                            'nickname' : "익명의 " + annonymousList[annonymous % 27],
                            'message': userNickname + " 님이 접속하셨습니다.",
                            "chatroomid": chatroomid
                        };
                        annonymous++;

                        db.collection("ChatRoom").insert(insertJson, (err) => {
                            if (err) console.log(err);
                        });

                        socket.to(chatroomid).emit("join", insertJson);
                        socket.broadcast.to(chatroomid).emit("join", insertJson);
                        socket.leave(chatroomid);
                    }
                });
            });

            // 새로운 채팅방이 생성되었을 때
            socket.on('newchatroom', (phoneNumber, chatroomid) => {
                console.log('New chatroom is detected.');
                socket.join(chatroomid);

                let db = client.db('taxi');
                let insertJson ={
                    'phoneNumber' : phoneNumber,
                    'nickname' : "익명의 " + annonymousList[annonymous % 27],
                    'message': "채팅방에 오신 걸 환영합니다!",
                    "chatroomid": chatroomid
                };
                annonymous++;
                db.collection('ChatRoom').insert(insertJson, (err) => {
                    if (err) console.log(err);
                });

                socket.to(chatroomid).emit("message", insertJson);
                socket.leave(chatroomid);
            });

            // 유저가 메세지를 보냈을 때
            socket.on('messagedetection', (senderNickname, messageContent, chatroomid) => {
                console.log('Message is Detected!!!!!!!!!!!!!');
                console.log(senderNickname+" :" +messageContent);
                socket.join(chatroomid);

                var db = client.db('taxi');
                //check phonenumber through PersonId
                db.collection('ChatRoom').findOne({$and:[{'nickname': senderNickname}, {'chatroomid': chatroomid}]}, (err, user) => {
                    if (err) console.log(err);

                    let phonenum = user.phoneNumber;
                    let insertJson = {
                        'phoneNumber' : phonenum,
                        'nickname' : senderNickname,
                        'message': messageContent,
                        'chatroomid': chatroomid
                    };
                    db.collection('ChatRoom').insertOne(insertJson, (err) => {
                        if (err) console.log(err);
                    });
                    //채팅 내역 들어올 때 마다 하나 출력
                    socket.to(chatroomid).emit('message', insertJson);
                    socket.broadcast.to(chatroomid).emit('message', insertJson);
                    console.log(insertJson);
                    socket.leave(chatroomid);
                });


                // var insertJson ={
                //     'ID' : PersonId,
                //     'Name' : senderNickname,
                //     'message': messageContent
                // };

                // var db = client.db('chatapp');
                // db.collection('ChatRoom').insertOne(insertJson, function(error, res){
                // })

                // var db = client.db('chatapp');
                // //check phonenumber through PersonId
                // db.collection('user').findOne({'ID': PersonId}, function(err,user){
                //     var phonenum = user.phonenumber
                //     let message = {"message":messageContent, "senderName":senderNickname, "phonenumber": phonenum}
                //     //채팅 내역 들어올 때 마다 하나 출력
                //     socket.emit('message', message);
                //     //socket.broadcast.emit('message', message);
                //     console.log(message);
                // })
                // let message = {"message":messageContent, "senderNickname":senderNickname}
                // socket.broadcast.emit('message', message);
            });

            socket.on('disconnect', function() {
                console.log('user has left')
                //socket.broadcast.emit("userdisconnect","user has left") 
            });
        });
    }
});
