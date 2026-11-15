export function call(handler: (req: Request, ctx: never) => Promise<Response>, req: Request, params?: Record<string, string>): Promise<Response> {
  return handler(req, { params: Promise.resolve(params ?? {}) } as never);
}
export function cookieFrom(res: Response): string { return res.headers.get('set-cookie')?.split(';')[0] ?? ''; }
