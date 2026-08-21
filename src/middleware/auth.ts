import { Request, Response, NextFunction } from 'express';

export function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction
) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    next();
}

export function requireRole(...roles: string[]) {
    return (
        req: Request,
        res: Response,
        next: NextFunction
    ) => {

        if (!req.session.user) {
            return res.redirect('/login');
        }

        if (!roles.includes(req.session.user.role)) {
            return res.status(403).render('pages/error', {
                title: 'Acceso denegado',
                message: 'No tienes permisos para esta sección.'
            });
        }

        next();
    };
}

/**
 * En Elite Soccer el entrenador es el administrador.
 */
export function canManage(req: Request) {
    return !!req.session.user &&
        req.session.user.role === 'coach';
}