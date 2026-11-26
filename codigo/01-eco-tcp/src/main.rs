// 01 · Eco TCP
// Servidor que devuelve lo que recibe. Consigna completa en codigo/README.md.
//
// Pistas:
// - std::net::TcpListener::bind y .incoming()
// - TcpStream implementa Read y Write (std::io)
// - Para leer por líneas: std::io::BufReader + .lines() o .read_line()
// - Para elegir servidor o cliente: std::env::args()

use std::{
    io::{BufReader, prelude::*},
    net::{TcpListener, TcpStream},
    env,
};

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() > 1 {
        
        if args[1] == "server" {
            init_server();
        } 
        if args[1] == "client" {
            init_client(args[2].to_string());
        }

    } else {
        println!("No se pasaron argumentos.");
    }

}

fn init_server() {
    let listener = TcpListener::bind("127.0.0.1:7000").unwrap();
    
    for stream in listener.incoming() {
        let stream = stream.unwrap();

        handle_connection(stream);
    }
}

fn handle_connection(stream: TcpStream) -> std::io::Result<()>  {
    let reader = BufReader::new(&stream);

    for line in reader.lines() {
        let message = line?;
        (&stream).write_all(format!("{message}\n").as_bytes())?;
    }

    Ok(())
}

fn init_client(message: String) -> std::io::Result<()>  {
    let mut stream = TcpStream::connect("127.0.0.1:7000")?;

    stream.write_all(format!("{message}\n").as_bytes())?;
    
    Ok(())
}