import jwt from 'jsonwebtoken';
function secret() {
    const value = process.env.JWT_SECRET;
    if (!value)
        throw new Error('JWT_SECRET is required');
    return value;
}
export function createToken(user) {
    return jwt.sign(user, secret(), { expiresIn: '12h' });
}
export function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token)
        return res.status(401).json({ error: 'Authentication required' });
    try {
        req.user = jwt.verify(token, secret());
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
export function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin')
        return res.status(403).json({ error: 'Admin permission required' });
    next();
}
