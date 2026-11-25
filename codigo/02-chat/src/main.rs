// 02 · Chat
// Varios clientes; lo que escribe uno lo ven todos. Consigna en codigo/README.md.
//
// Pistas:
// - std::thread::spawn por cada conexión
// - Los clientes conectados se comparten entre threads: Arc<Mutex<...>>
// - TcpStream::try_clone() para tener una copia para leer y otra para escribir
// - Alternativa a compartir la lista: un thread "central" que recibe por un mpsc::channel

fn main() {
    todo!("escribir el servidor de chat");
}
