# APISPECTS

**One spec → typed router + typed client + typed errors. Zero drift. Superb DX.**

* maximum code sharing between nodes
* fully typed end to end (including errors)
* uniform error handling
* generates **router** and **apiClient** and router from same spec(SSOT/contract)

One SSOT for routes, payloads, errors, and client calls — with superb DX.

**Install**

`npm i @apispects/core`

## Quickstart

1. **Declare your spec**

```ts
export const authRouter = {
  register_post: {
    bodySchema: registerRequestSchema,
    responseSchema: z.object({ token: z.string() }),
    cbErrorSchema: registrationError,
  },
  login_post: {
    bodySchema: loginRequestSchema,
    responseSchema: z.object({ token: z.string() }),
    cbErrorSchema: loginErrors,
  },
  refreshToken_post: {
    headerSchema: authHeader,
    cbErrorSchema: z.null(),
    responseSchema: z.object({ token: z.string() }),
  }
} as const satisfies ApiSpec;

export const apiSpec = {
  api: {
    auth: authRouter,
    macro: macroRouter
  }
} as const satisfies ApiSpec; //key line TS 5 dependent
``` 

Declare schemas, sastisfy `ApiSpec`, and generate both router and client:


```ts
const { router: apiRouter } = makeApi(apiSpec, {}, express.Router)


export const registerUser = async (email: string, name: string, password: string) => {
  const existingUser = await prismaClient.user.findUnique({
    where: { email }
  })

  if (existingUser) return 'User with given email already exists';

  const user = await prismaClient.user.create({
    data: { email, name, 
      passwords: { create: { password: await bcrypt.hash(password, 6) } }
    },
  })

  return user
}

//everything fully types out of the box, autocomplete DX
makeController(authRouter.register_post, async ({ body: { email, name, password} }) => {
  const user = await registerUser(email, name, password);
  if (typeof user === 'string') return user; // error message
  return { token: jwtSign({ userId: user.id }) };
})
```

and client

```ts
export const { apiClient } = makeApi(apiSpec, {
  baseUrl: 'http://localhost:3033'
})
```