'use strict';

const express = require('express');

module.exports = (io) => {
    const router = express.Router();
    const ctrl = require('../controllers/channelController');

    router.use((req, res, next) => {
        req.io = io;
        next();
    });

    router.get('/', ctrl.listChannels);
    router.post('/', ctrl.createChannel);
    router.put('/:id', ctrl.updateChannel);
    router.delete('/:id', ctrl.deleteChannel);

    router.post('/messages', ctrl.sendMessage);
    router.get('/groups', ctrl.listGroups);

    router.get('/membership-matrix', ctrl.getMembershipMatrix);
    router.post('/membership', ctrl.updateMembership);

    return router;
};
