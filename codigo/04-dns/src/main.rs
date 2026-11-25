// 04 · Cliente DNS desde cero
// Armar la consulta a mano, mandarla por UDP a AdGuard y parsear la respuesta.
// Consigna en codigo/README.md. Guía: https://github.com/EmilHernvall/dnsguide
//
// Pistas:
// - El formato está en la RFC 1035, sección 4
// - En la red todo va en big-endian: u16::to_be_bytes / u16::from_be_bytes
// - std::net::UdpSocket::bind("0.0.0.0:0"), send_to, recv_from
// - Escribir tests para el parser con una respuesta guardada de Wireshark

fn main() {
    todo!("escribir el cliente DNS");
}
