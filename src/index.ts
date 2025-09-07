import type { ZodIssue, ZodTypeAny } from 'zod';
import z, { ZodDate, ZodDefault, ZodEffects, ZodNullable, ZodObject, ZodOptional } from 'zod';
import type { Router, Request, Response, RequestHandler } from 'express'

type ErrRes<Msg = z.infer<typeof validationError>, Body = ZodIssue[]> = {
  msg: Msg;
  body?: Body;
};
type CallbackError<T> = {
  msg: 'Callback error';
  body: T;
}

const validationError = z.literal('Invalid body')
  .or(z.literal('Invalid query'))
  .or(z.literal('Invalid params'))
  .or(z.literal('Invalid headers'))
  .or(z.literal('Internal Breaking response contract'))
  .or(z.literal('Internal server error'))

export const errRes = (msg: string, body?: any) => ({ error: { msg, body } });

type Infer<T extends z.ZodTypeAny> = z.infer<T>;

export type ControllerSpec<
  BodySchema extends z.ZodTypeAny | undefined,
  QuerySchema extends z.ZodTypeAny | undefined,
  ParamsSchema extends z.ZodTypeAny | undefined,
  HeaderSchema extends z.ZodTypeAny | undefined,
  ResponseSchema extends z.ZodTypeAny,
  CbErrorsSchema extends z.ZodTypeAny
> = {
  bodySchema?: BodySchema;
  querySchema?: QuerySchema;
  paramsSchema?: ParamsSchema;
  headerSchema?: HeaderSchema;
  responseSchema: ResponseSchema;
  cbErrorSchema: CbErrorsSchema;
  cb?: (
    args: {
      body: BodySchema extends z.ZodTypeAny ? Infer<BodySchema> : undefined;
      query: QuerySchema extends z.ZodTypeAny ? Infer<QuerySchema> : undefined;
      params: ParamsSchema extends z.ZodTypeAny ? Infer<ParamsSchema> : undefined;
      headers: HeaderSchema extends z.ZodTypeAny ? Infer<HeaderSchema> : undefined;
      req: Request;
      res: Response;
    },
    schemas: {
      bodySchema?: BodySchema;
      querySchema?: QuerySchema;
      paramsSchema?: ParamsSchema;
      headerSchema?: HeaderSchema;
      responseSchema: ResponseSchema;
      cbErrorSchema: CbErrorsSchema;
    }
  ) => Promise<z.infer<ResponseSchema> | z.infer<CbErrorsSchema>>
};

type ApiClientFunction<Spec extends ControllerSpec<any, any, any, any, any, any>> = (
  args: {
    body?: z.infer<Spec['bodySchema']>;
    query?: z.infer<Spec['querySchema']>;
    params?: z.infer<Spec['paramsSchema']>;
    headers?: z.infer<Spec['headerSchema']>;
  }
) => Promise<{
  data: z.infer<Spec['responseSchema']>;
  error?:
    ErrRes<z.infer<typeof validationError>> | CallbackError<z.infer<Spec['cbErrorSchema']>>
}>;

export function makeController<
  BodySchema extends z.ZodTypeAny | undefined,
  querySchema extends z.ZodTypeAny | undefined,
  ParamsSchema extends z.ZodTypeAny | undefined,
  HeaderSchema extends z.ZodTypeAny | undefined,
  ResponseSchema extends z.ZodTypeAny,
  CbErrorsSchema extends z.ZodTypeAny
>(schemas: ControllerSpec<BodySchema, querySchema, ParamsSchema, HeaderSchema, ResponseSchema, CbErrorsSchema>,
  cb: ControllerSpec<BodySchema, querySchema, ParamsSchema, HeaderSchema, ResponseSchema, CbErrorsSchema>['cb'],
  ...middleware: RequestHandler[]
) {
  const {
    bodySchema, querySchema, paramsSchema, headerSchema, responseSchema, cbErrorSchema
  } = schemas;
  schemas.cb = cb;
  (schemas as any).middleware = middleware;
  (schemas as any).ctrl = async (req: Request, res: Response) => {
    if (bodySchema) {
      const unpackSchema = withSerializableDates(bodySchema as any);
      const isValidRequest = unpackSchema.safeParse(req.body);
      if (!isValidRequest.success) {
        res.status(400).json(errRes('Invalid body', isValidRequest.error.errors));
        return;
      }
      req.body = unpackSchema.parse(req.body);
    }

    if (querySchema) {
      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json(errRes('Invalid query', parsed.error.errors));
        return
      }
      req.query = parsed.data;
    }
    if (paramsSchema) {
      const parsed = paramsSchema.safeParse(req.params);
      if (!parsed.success) {
        res.status(400).json(errRes('Invalid params', parsed.error.errors));
        return
      }
      req.params = parsed.data;
    }
    if (headerSchema) {
      const parsed = headerSchema.safeParse(req.headers);
      if (!parsed.success) {
        res.status(400).json({...errRes('Invalid headers', parsed.error.errors)});
        return
      }
      req.headers = parsed.data;
    }

    try {
      if (!cb) {
        throw new Error('Controller callback function is not defined');
      }
      for (const mw of middleware) {
        const mwRes = mw(req, res, () => {}) as unknown;
        if (mwRes && mwRes instanceof Promise) {
          await mwRes;
        }
        if (res.headersSent) {
          //resSent = true;
          return;
        }
      }

      /* middleware.forEach(mw => {
        if (!(resSent = !!res.headersSent)) {
          const mwRes = mw(req, res, () => {})
        }
      }) */
      if (res.headersSent) {
        return;
      }

      const result = await cb({
        body: req.body,
        query: req.query as any,
        params: req.params as any,
        headers: req.headers as any,
        req, res
      },
        { bodySchema, responseSchema, cbErrorSchema, querySchema, paramsSchema, headerSchema });
      if (cbErrorSchema.safeParse(result).success) {
        res.status(400).json({ ...errRes('Callback error', result)});
        return;
      }
      if (process.env.ENV === 'dev') {
        const isValidResponse = responseSchema?.safeParse(result);
        if (responseSchema && !isValidResponse?.success) {
          console.error(`Internal Invalid response ${isValidResponse?.error}`)
          res.status(500).json({...errRes('Internal Breaking response contract')});
          return;
        }
      }
      res.json({ data: result });
    } catch (error) {
      console.error('Error in controller:', error);
      res.status(500).json({...errRes('Internal server error') });
    }
  }
}

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';
export type PathMethod = `${string}_${HttpMethod}`;

export type ControllerLeaf = {
  [K in PathMethod]?: ControllerSpec<any, any, any, any, any, any>;
};

type RouterBranch = {
  [key: string]: RouterSpec;
};

export type RouterSpec = ControllerLeaf | RouterBranch;

export type ApiSpec = RouterSpec;

export type ControllerFunction<Spec extends ControllerSpec<any, any, any, any, any, any>> = (
  args: { body: Spec['bodySchema'] extends z.ZodTypeAny ? z.infer<Spec['bodySchema']> : undefined; } 
  & ( Spec['querySchema'] extends z.ZodTypeAny ? { query  : z.infer<Spec['querySchema']> }  : {} )
  & (Spec['paramsSchema'] extends z.ZodTypeAny ? { params : z.infer<Spec['paramsSchema']> } : {} )
  & (Spec['headerSchema'] extends z.ZodTypeAny ? { headers: z.infer<Spec['headerSchema']> } : {}) 
) => Promise<z.infer<Spec['responseSchema']> | z.infer<Spec['cbErrorSchema']>>;

export type ApiType<T> = {
  [K in keyof T]:
    K extends PathMethod
      ? ApiClientFunction<Extract<T[K], ControllerSpec<any, any, any, any, any, any>>>
      : ApiType<T[K]>;
};

/* export type ApiType<T> = {
  [K in keyof T]:
    K extends PathMethod
      ? ControllerFunction<Extract<T[K], ControllerSpec<any, any, any, any, any, any>>>
      : ApiType<T[K]>;
}; */

type FetchArgs = {
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

const mockRouter = {
  use: () => {},
  get: () => {},
  post: () => {},
  put: () => {},
  delete: () => {},
  patch: () => {}
}

const defaultExpRouter = () => mockRouter as unknown as Router;

export function makeApi<const T extends ApiSpec>(
  spec: T,
  config: FetchArgs = {},
  expRouter: () => Router = defaultExpRouter
): {
  apiClient: ApiType<T>,
  router: Router,
} {
  const baseUrl = config.baseUrl || '';

  const walk = (node: ApiSpec, path: string[] = []) => {
    const result: Record<string, any> = {};
    const router = expRouter ? expRouter() : (mockRouter as unknown as Router)
  
    for (const key in node) {
      const val = (node as any)[key];
    
      // This key is itself a ControllerSpec (like login_post)
      if (isControllerSpec(val)) {
        const [subpath, method] = parsePathMethod(key as PathMethod);
        const fullPath = [...path, subpath].join('/');

        if (!val.cb && expRouter !== defaultExpRouter) {
          throw new Error(`Controller callback function is not defined for "${fullPath}"`);
        }
        router[method]('/' + subpath, (val as any).ctrl);
    
        result[key] = async (args: {
          body?: any;
          query?: Record<string, any>;
          headers?: Record<string, string>;
        }) => {
          const url = new URL(`${baseUrl}/${fullPath}`);
    
          if (args?.query) {
            for (const [k, v] of Object.entries(args.query)) {
              url.searchParams.append(k, String(v));
            }
          }
    
          const res = await fetch(url.toString(), {
            method: method.toUpperCase(),
            headers: {
              'Content-Type': 'application/json',
              ...(args?.headers || {}),
            },
            ...(method !== 'get' && {
              body: args?.body ? JSON.stringify(args.body) : undefined,
            }),
          });
    
          const json = await res.json();

          const unpackSchema = withSerializableDates(val.responseSchema);
          return json.error ? json : { data: unpackSchema.parse(json.data) }
        };
      }
      else if (isRouterBranch(val)) {
        const { router: subrouter, apiClient: subresult } = walk(val, [...path, key]);
        result[key] = subresult;
        router.use(`/${key}`, subrouter);
      } 
      else console.warn(`Skipped unknown structure at "${[...path, key].join('/')}"`);
    }
    
    return {
      apiClient: result as ApiType<T>,
      router
    };
  };

  const res =  walk(spec)
  return res
}

// --- Utils


function parsePathMethod(methodKey: PathMethod): [string, HttpMethod] {
  const match = methodKey.match(/^(.+)_(get|post|put|delete|patch)$/);
  if (!match) throw new Error(`Invalid PathMethod: ${methodKey}`);
  return [match[1], match[2] as HttpMethod];
}


function isControllerSpec(val: any): val is ControllerSpec<any, any, any, any, any, any> {
  return (
    typeof val === 'object' &&
    val !== null &&
    'responseSchema' in val &&
    'cbErrorSchema' in val //&&
    //'cb' in val
  );
}

function isRouterBranch(val: any): val is ApiSpec {
  return (
    typeof val === 'object' &&
    val !== null &&
    !isControllerSpec(val)
  );
}

function isDateSchema(schema: ZodTypeAny): boolean {
  if (schema instanceof ZodDate) return true;
  if (schema instanceof ZodOptional
   || schema instanceof ZodNullable
   || schema instanceof ZodDefault
  ) {
    return isDateSchema(schema._def.innerType);
  }
  return false;
}

export function withSerializableDates<
  T extends ZodObject<any, any>
>(schema: T): ZodEffects<T, z.infer<T>> {
  const dateKeys = Object.entries(schema.shape)
    .filter(([, sub]) => isDateSchema(sub as any))
    .map(([key]) => key);

  return z.preprocess(
    (val) => {
      if (typeof val === 'object' && val !== null) {
        for (const key of dateKeys) {
          const v = (val as any)[key];
          if (typeof v === 'string') {
            (val as any)[key] = new Date(v);
          }
        }
      }
      return val;
    },
    schema
  ) as any;
}