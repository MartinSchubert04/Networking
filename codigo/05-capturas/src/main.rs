// 05 · Lector de capturas
// Leer un .pcap y decodificar Ethernet -> IPv4 -> TCP/UDP a mano. Consigna en codigo/README.md.
//
// Pistas:
// - Formato pcap: header global de 24 bytes, después por cada paquete un header de 16 bytes + los datos
// - El "magic number" del header dice si el archivo es little o big-endian
// - Guardar la captura desde Wireshark como "pcap" (no "pcapng") para empezar
// - Las capturas van en la carpeta capturas/ del repo (no se suben a git)

fn main() {
    todo!("escribir el lector de capturas");
}
