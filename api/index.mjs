import {createReportServer} from '../server.mjs';
import {makeVercelHandler} from '../lib/vercel-handler.mjs';
export default makeVercelHandler(createReportServer({serverless:true,persistCache:false}));
