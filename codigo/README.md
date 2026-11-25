# Código: redes en Rust

Proyectos para entender redes escribiendo el código yo mismo, y de paso aprender Rust.

> **Regla:** el código lo escribo yo. La IA da pistas, explica errores del compilador y revisa, pero no escribe la solución.

## Cómo se usa

Es un workspace de Cargo: cada proyecto es un crate.

```bash
cd codigo
cargo run -p eco-tcp        # correr un proyecto
cargo check                 # compilar todo sin generar binarios
cargo test -p dns           # tests de un proyecto
```

### Dónde correrlo

Conviene en el **server**: es Linux, ahí están las herramientas para comparar (tcpdump, nmap, dig), y el 05 con captura en vivo y el 07 solo andan en Linux. También corre en Windows (del 01 al 04 y el 06).

Rust todavía no está instalado en el server, y `/` está casi lleno, así que va en `/mnt/data`:

```bash
export RUSTUP_HOME=/mnt/data/rust/rustup CARGO_HOME=/mnt/data/rust/cargo
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# agregar esas dos variables y "source /mnt/data/rust/cargo/env" al final de ~/.bashrc
cd /mnt/data/lab && git clone https://github.com/MartinSchubert04/Networking.git
```

Para editar: VS Code en la PC con la extensión **Remote - SSH**, abriendo la carpeta del server. Se edita como si fuera local y la terminal integrada corre en el server.

Antes de arrancar conviene leer los capítulos 1 a 9 del [Rust Book](https://doc.rust-lang.org/book/) y hacer los ejercicios equivalentes de Rustlings. Ver [RECURSOS](../RECURSOS.md).

---

## 01 · Eco TCP

`01-eco-tcp/` · Un servidor que devuelve todo lo que le mandan, y un cliente para probarlo.

**Redes:** sockets, TCP, `bind` / `listen` / `accept`, puertos.
**Rust:** ownership, `Result` y `?`, `std::net`, leer argumentos.

- [ ] Servidor que escucha en `127.0.0.1:7000` y devuelve lo que recibe
- [ ] Probarlo con `telnet` o `ncat` antes de escribir el cliente
- [ ] Cliente que manda una línea y muestra la respuesta
- [ ] Capturar la conexión con Wireshark y encontrar el handshake (SYN, SYN-ACK, ACK) y el cierre (FIN)
- [ ] ¿Qué pasa si se conectan dos clientes a la vez? Anotar por qué

## 02 · Chat

`02-chat/` · Varios clientes conectados; lo que escribe uno lo ven todos.

**Redes:** conexiones simultáneas, qué pasa cuando un cliente se cae.
**Rust:** threads, `Arc<Mutex<..>>`, channels (`mpsc`), después `tokio`.

- [ ] Un thread por cliente
- [ ] Lista compartida de clientes para reenviar mensajes
- [ ] Manejar desconexiones sin que se caiga el servidor
- [ ] Nombres de usuario (`/nick`)
- [ ] Reescribirlo con `tokio` y comparar

## 03 · Mini nmap

`03-escaner/` · Escáner de puertos TCP. **Solo contra cosas mías.**

**Redes:** TCP connect, timeouts, puerto abierto / cerrado / filtrado.
**Rust:** async con `tokio`, limitar la concurrencia, medir tiempos.

- [ ] Escanear un rango de puertos de un host, uno por uno
- [ ] Timeout por puerto
- [ ] Distinguir cerrado (rechaza la conexión) de filtrado (no contesta)
- [ ] Escaneo concurrente con un límite (por ejemplo 200 a la vez)
- [ ] Comparar el resultado contra `nmap` en el server

## 04 · Cliente DNS desde cero

`04-dns/` · Armar una consulta DNS byte a byte, mandarla por UDP a AdGuard y entender la respuesta. Guía: [dnsguide](https://github.com/EmilHernvall/dnsguide).

**Redes:** formato de un paquete DNS, UDP, tipos de registro (A, AAAA, CNAME, MX), compresión de nombres.
**Rust:** bytes, big-endian, structs, enums, parsing, tests.

- [ ] Struct para el header y para la pregunta
- [ ] Serializar una consulta tipo A
- [ ] Mandarla por UDP y recibir la respuesta
- [ ] Parsear el header y las respuestas
- [ ] Manejar la compresión de nombres
- [ ] Soportar AAAA, CNAME y MX
- [ ] Comparar con `dig` y con la captura de Wireshark
- [ ] Bonus: convertirlo en un resolver recursivo (preguntar desde los root servers)

## 05 · Lector de capturas

`05-capturas/` · Leer un `.pcap` guardado con Wireshark y decodificar cada paquete a mano: Ethernet → IP → TCP/UDP.

**Redes:** cómo se arma un paquete capa por capa, headers, checksums.
**Rust:** parsing binario, traits, manejo de errores.

- [ ] Leer el formato pcap (header global + header por paquete)
- [ ] Decodificar Ethernet (MACs, EtherType)
- [ ] Decodificar IPv4 (IPs, TTL, protocolo)
- [ ] Decodificar TCP y UDP (puertos, flags)
- [ ] Resumen tipo Wireshark: una línea por paquete
- [ ] Bonus: captura en vivo con el crate `pcap` (Linux)

## 06 · Servidor HTTP desde cero

`06-http/` · Es el último capítulo del Rust Book.

**Redes:** HTTP sobre TCP, request y response, headers.
**Rust:** thread pool, closures, `Drop`.

- [ ] Responder `GET /` con un HTML
- [ ] 404 para el resto
- [ ] Servir archivos de una carpeta
- [ ] Thread pool
- [ ] Apagado ordenado

## 07 · Bonus de seguridad

Sin crate todavía; se crea cuando toque.

- [ ] **Detector de escaneos:** leer una captura (con el código del 05) y detectar un nmap
- [ ] **Ping:** ICMP echo con raw sockets (Linux, root)
- [ ] **Traceroute:** jugar con el TTL
