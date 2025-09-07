const admin = require('../firebase-admin');

module.exports = async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token ausente' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        if (!decodedToken.role) {
            const doc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
            const role = doc.exists ? doc.data().role : null;
            if (role) {
                await admin.auth().setCustomUserClaims(decodedToken.uid, { role });
                decodedToken.role = role;
            }
        }
        req.user = decodedToken; // ESSENCIAL
        next();
    } catch (error) {
        console.error('Erro ao verificar token:', error);
        return res.status(401).json({ message: 'Token inválido' });
    }
};



