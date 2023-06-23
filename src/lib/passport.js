const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const pool = require('../database');
const helpers = require('../lib/helpers');
const { route } = require('../routes');

passport.use('local.signin', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
},async(req, username, password, done)=>{
    
    const rows = await pool.query('SELECT * FROM persona WHERE usuario = ?', [username]);
    if(rows.length>0){
        const user = rows[0];
        const validPassword = await helpers.matchPassword(password, user.contrasena);
        if(validPassword){            
            done(null, user, req.flash('success', "Bienvenido" + user.usuario)) ;            
        }else{
            done(null, false, req.flash('danger','Datos Incorrectos'));
        }
    }else{
        return done(null, false, req.flash('danger','Datos Incorrectos'))
    }
}));

passport.use('local.signup', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}, async(req, username, password, done)=>{
    const {nombres, apellidos, carnet} = req.body;
    const newUser = {
        nombres, 
        apellidos, 
        carnet
    };
    const newPaciente = {}
    newUser.contrasena = await helpers.encryptPassword(password);
    
    const resul = await pool.query('INSERT INTO persona SET ?', [newUser]);
    newUser.id = resul.insertId;
    newPaciente.idPersona = newUser.id;
    await pool.query('INSERT INTO user SET ?', [newPaciente]);
    //console.log(newUser.id)
    return done(null, newUser);
}));

passport.serializeUser((user, done)=>{
    var identificador;
    if(user.id){
        identificador = user.id;
    }else{
        identificador = user.idPersona;
    }
    done(null, identificador);
});

passport.deserializeUser(async(id, done)=>{
    const row = await pool.query('call verUsuario(?);', [id]);
    const user = row[0];
    done(null, user[0]);
});