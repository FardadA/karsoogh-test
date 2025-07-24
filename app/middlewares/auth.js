'use strict';

function isAdmin(req, res, next) {
    if (req.session.adminId) return next();
    res.redirect('/');
}

function isUser(req, res, next) {
    if (req.session.userId) return next();
    res.redirect('/');
}

module.exports = { isAdmin, isUser };
