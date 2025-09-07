import type { ZodIssue } from 'zod';
import z, { ZodEffects, ZodObject } from 'zod';
import type { Router, Request, Response, RequestHandler } from 'express';
type ErrRes<Msg = z.infer<typeof validationError>, Body = ZodIssue[]> = {
    msg: Msg;
    body?: Body;
};
type CallbackError<T> = {
    msg: 'Callback error';
    body: T;
};
declare const validationError: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"Invalid body">, z.ZodLiteral<"Invalid query">]>, z.ZodLiteral<"Invalid params">]>, z.ZodLiteral<"Invalid headers">]>, z.ZodLiteral<"Internal Breaking response contract">]>, z.ZodLiteral<"Internal server error">]>;
export declare const errRes: (msg: string, body?: any) => {
    error: {
        msg: string;
        body: any;
    };
};
type Infer<T extends z.ZodTypeAny> = z.infer<T>;
export type ControllerSpec<BodySchema extends z.ZodTypeAny | undefined, QuerySchema extends z.ZodTypeAny | undefined, ParamsSchema extends z.ZodTypeAny | undefined, HeaderSchema extends z.ZodTypeAny | undefined, ResponseSchema extends z.ZodTypeAny, CbErrorsSchema extends z.ZodTypeAny> = {
    bodySchema?: BodySchema;
    querySchema?: QuerySchema;
    paramsSchema?: ParamsSchema;
    headerSchema?: HeaderSchema;
    responseSchema: ResponseSchema;
    cbErrorSchema: CbErrorsSchema;
    cb?: (args: {
        body: BodySchema extends z.ZodTypeAny ? Infer<BodySchema> : undefined;
        query: QuerySchema extends z.ZodTypeAny ? Infer<QuerySchema> : undefined;
        params: ParamsSchema extends z.ZodTypeAny ? Infer<ParamsSchema> : undefined;
        headers: HeaderSchema extends z.ZodTypeAny ? Infer<HeaderSchema> : undefined;
        req: Request;
        res: Response;
    }, schemas: {
        bodySchema?: BodySchema;
        querySchema?: QuerySchema;
        paramsSchema?: ParamsSchema;
        headerSchema?: HeaderSchema;
        responseSchema: ResponseSchema;
        cbErrorSchema: CbErrorsSchema;
    }) => Promise<z.infer<ResponseSchema> | z.infer<CbErrorsSchema>>;
};
type ApiClientFunction<Spec extends ControllerSpec<any, any, any, any, any, any>> = (args: {
    body?: z.infer<Spec['bodySchema']>;
    query?: z.infer<Spec['querySchema']>;
    params?: z.infer<Spec['paramsSchema']>;
    headers?: z.infer<Spec['headerSchema']>;
}) => Promise<{
    data: z.infer<Spec['responseSchema']>;
    error?: ErrRes<z.infer<typeof validationError>> | CallbackError<z.infer<Spec['cbErrorSchema']>>;
}>;
export declare function makeController<BodySchema extends z.ZodTypeAny | undefined, querySchema extends z.ZodTypeAny | undefined, ParamsSchema extends z.ZodTypeAny | undefined, HeaderSchema extends z.ZodTypeAny | undefined, ResponseSchema extends z.ZodTypeAny, CbErrorsSchema extends z.ZodTypeAny>(schemas: ControllerSpec<BodySchema, querySchema, ParamsSchema, HeaderSchema, ResponseSchema, CbErrorsSchema>, cb: ControllerSpec<BodySchema, querySchema, ParamsSchema, HeaderSchema, ResponseSchema, CbErrorsSchema>['cb'], ...middleware: RequestHandler[]): void;
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
export type ControllerFunction<Spec extends ControllerSpec<any, any, any, any, any, any>> = (args: {
    body: Spec['bodySchema'] extends z.ZodTypeAny ? z.infer<Spec['bodySchema']> : undefined;
} & (Spec['querySchema'] extends z.ZodTypeAny ? {
    query: z.infer<Spec['querySchema']>;
} : {}) & (Spec['paramsSchema'] extends z.ZodTypeAny ? {
    params: z.infer<Spec['paramsSchema']>;
} : {}) & (Spec['headerSchema'] extends z.ZodTypeAny ? {
    headers: z.infer<Spec['headerSchema']>;
} : {})) => Promise<z.infer<Spec['responseSchema']> | z.infer<Spec['cbErrorSchema']>>;
export type ApiType<T> = {
    [K in keyof T]: K extends PathMethod ? ApiClientFunction<Extract<T[K], ControllerSpec<any, any, any, any, any, any>>> : ApiType<T[K]>;
};
type FetchArgs = {
    baseUrl?: string;
    fetchFn?: typeof fetch;
};
export declare function makeApi<const T extends ApiSpec>(spec: T, config?: FetchArgs, expRouter?: () => Router): {
    apiClient: ApiType<T>;
    router: Router;
};
export declare function withSerializableDates<T extends ZodObject<any, any>>(schema: T): ZodEffects<T, z.infer<T>>;
export {};
//# sourceMappingURL=index.d.ts.map