export type User={
    id:string,
    ws:any
}
export type Room={
    id:string,
   players:string[],
   gameStatus:"active"|"over"|"waiting"
}