// 03 · Mini nmap
// Escáner de puertos TCP. Solo contra cosas mías. Consigna en codigo/README.md.
//
// Pistas:
// - Versión simple: std::net::TcpStream::connect_timeout
// - Qué error da un puerto cerrado y cuál uno filtrado? Mirar io::ErrorKind
// - Versión concurrente: agregar tokio y usar tokio::time::timeout + un Semaphore
//   (cargo add tokio --features full)

fn main() {
    todo!("escribir el escáner");
}
