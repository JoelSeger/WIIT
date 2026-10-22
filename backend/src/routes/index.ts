import express, { Request, Response, NextFunction } from 'express';
import { TreeController } from '../controllers/treeController';

export function setRoutes(app: any) {
    app.get('/', (_req: Request, res: Response) => {
        res.send('Servern körs!');
    });

    app.get('/mau-arkiv/process/tree', (req: Request, res: Response) => {
        res.send('This is where the tree will be later :D')
    });
}
