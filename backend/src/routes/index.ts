import type { NextFunction, Request, Response, RequestHandler } from 'express';
import type { Knex } from 'knex';
import { ArchiveController } from '../controllers/archiveController';
import { ClassificationController } from '../controllers/classificationController';
import { RequestContext } from '../types/requestContext';

/** Boundary that registers the API URLs and maps each one to a controller method. */
export class Index {
  /* Keeps the shared Knex connection so each incoming API call can create a controller with database access. */
  constructor(private readonly db: Knex) {}

  /* Registers the project's REST URLs with Express and maps each URL/method pair to the matching controller operation. The small handler factories keep route declarations readable while ensuring controllers are created for each request. */
  setRoutes(app: any): void {

    /* Creates an Express handler for classification operations. The selected method is invoked on a new ClassificationController with a context built from the current request. */
    const classification = (method: 'getTree' | 'getOne' | 'create' | 'remove' | 'update' | 'getSeries'): RequestHandler =>
      this.controllerHandler((context, req, res) => new ClassificationController(context)[method](req, res));

    /* Creates an Express handler for archive-tree and series-creation operations handled by ArchiveController. */
    const archive = (method: 'getTree' | 'createSeries'): RequestHandler =>
      this.controllerHandler((context, req, res) => new ArchiveController(context)[method](req, res));

    /* Creates an Express handler for series and volume operations handled by ArchiveController. */
    const archiveItem = (method: 'deleteSeries' | 'updateSeries' | 'getVolumes' | 'createVolume' | 'updateVolume' | 'deleteVolume'): RequestHandler =>
      this.controllerHandler((context, req, res) => new ArchiveController(context)[method](req, res));

    /* Answers the root health-check URL with a short text message so a caller can tell the server process is responding. */
    app.get('/', (_req: Request, res: Response) => res.send('Servern körs!'));


    app.get('/mau-arkiv/processes/tree', classification('getTree'));
    app.get('/mau-arkiv/processes/:id', classification('getOne'));
    app.post('/mau-arkiv/processes', classification('create'));
    app.delete('/mau-arkiv/processes/:id', classification('remove'));

    app.put('/mau-arkiv/processes/:id',classification('update'));
    app.get('/mau-arkiv/archives/tree', archive('getTree'));
    app.get('/mau-arkiv/archives/:archiveId/series/:seriesId', classification('getSeries'));

    app.post('/mau-arkiv/archive/:archiveId/series', archive('createSeries'));
    app.delete('/mau-arkiv/archives/:archiveId/series/:seriesId', archiveItem('deleteSeries'));
    app.put('/mau-arkiv/archives/:archiveId/series/:seriesId',archiveItem('updateSeries'));
    app.get('/mau-arkiv/archives/:archiveId/series/:seriesId/volumes', archiveItem('getVolumes'));
    app.post('/mau-arkiv/archives/:archiveId/series/:seriesId/volumes', archiveItem('createVolume'));
    app.put('/mau-arkiv/archives/volumes/:volumeId', archiveItem('updateVolume'));
    app.delete('/mau-arkiv/archives/volumes/:volumeId', archiveItem('deleteVolume'));
  }


  /* this adapts the asynchronous controller action to Express: it creates a RequestContext for the current request,
  runs the action and then forwards rejected promises for Express for error handling. */

  private controllerHandler(
    action: (context: RequestContext, req: Request, res: Response) => Promise<void>,
  ): RequestHandler {

    /* Express invokes this for each matching request; it builds per-request dependencies and
    forwards the rejected controller promisees to next(error). */

    return (req: Request, res: Response, next: NextFunction): void => {

      //Controllers constructed per request; their RequestContext contains the current session user.
      void action(new RequestContext(req, this.db), req, res).catch(next);
    };
  }
}
