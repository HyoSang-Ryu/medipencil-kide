export async function GET(request:Request,context:{params:Promise<{screen:string}>}){
 const {screen}=await context.params;
 if(/^[1-9]$/.test(screen))return Response.redirect(new URL(`/${screen}.html${new URL(request.url).search}`,request.url),302);
 return new Response('Not found',{status:404});
}
