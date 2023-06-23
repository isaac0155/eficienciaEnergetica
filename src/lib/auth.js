module.exports ={

    isLoggedIn(req, res, next){
        if (req.isAuthenticated()){
            return next();
        }
        req.flash('warning', 'Inicia Sesión para ver la página');
        return res.redirect('/signin');
    },
    isNotLoggedIn(req, res, next){
        if (!req.isAuthenticated()){
            return next();
        }
        return res.redirect('/profile');
    }

}