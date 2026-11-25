# Recursos

Todo el material del repo en un solo lugar. ⭐ = por dónde empezar.

## Redes

| Recurso | Qué es | Para qué fase |
|---|---|---|
| ⭐ [Cisco Packet Tracer](https://www.netacad.com) | Simulador de redes de Cisco. Gratis con cuenta de NetAcad (sección *Resources*). Bajarlo **solo** de ahí. | 02 |
| ⭐ [Jeremy's IT Lab](https://www.youtube.com/@JeremysITLab) | Curso gratis de CCNA 200-301 en YouTube. Cada "Day" tiene teoría + lab de Packet Tracer; los archivos del lab están en la descripción del video. | 01, 02 |
| [Getting Started with Cisco Packet Tracer](https://www.netacad.com) | Curso corto y gratis de NetAcad para aprender a usar el programa. | 02 |
| [Exploring Networking with Cisco Packet Tracer](https://www.netacad.com) | Curso gratis de NetAcad (~3 h), complemento del anterior. | 02 |
| [Professor Messer](https://www.professormesser.com) | Videos gratis de Network+ y Security+. Buen repaso de teoría. | 01, 05 |
| [Beej's Guide to Network Programming](https://beej.us/guide/bgnet/) | La mejor explicación de cómo funcionan los sockets por dentro (en C). | código |

## Linux y Debian

| Recurso | Qué es |
|---|---|
| ⭐ [The Linux Command Line](https://linuxcommand.org/tlcl.php) | Libro gratis de William Shotts: la terminal desde cero hasta scripts. |
| [OverTheWire Bandit](https://overthewire.org/wargames/bandit/) | Wargame por SSH: la mejor práctica de terminal que hay. |
| [The Debian Administrator's Handbook](https://debian-handbook.info) | Libro gratis sobre administrar Debian: apt, servicios, red, seguridad. |
| [tldr pages](https://tldr.sh) | Ejemplos cortos de cada comando (`tldr tcpdump`). |
| [explainshell](https://explainshell.com) | Pegás un comando y te explica cada parte. Usarlo antes de correr algo copiado. |
| [VS Code Remote - SSH](https://code.visualstudio.com/docs/remote/ssh) | Editar archivos del server desde VS Code en la PC. |

## Ciberseguridad práctica

| Recurso | Qué es |
|---|---|
| ⭐ [TryHackMe](https://tryhackme.com) | Cursos guiados con máquinas en el navegador. Empezar por *Pre Security*, después *Jr Penetration Tester*. |
| [PicoCTF](https://picoctf.org) | CTFs para principiantes, con práctica todo el año. |
| [Hack The Box Academy](https://academy.hackthebox.com) | Módulos más profundos, para después de TryHackMe. |

## Herramientas

| Herramienta | Para qué | Fase |
|---|---|---|
| [Wireshark](https://www.wireshark.org) | Ver paquetes con interfaz gráfica | 01 |
| [tcpdump](https://www.tcpdump.org) | Capturar paquetes desde la terminal (en el server) | 01 |
| [nmap](https://nmap.org) | Descubrir hosts y puertos | 01, 04 |
| [containerlab](https://containerlab.dev) | Labs de routers en contenedores, definidos en YAML | 02 |
| [OPNsense](https://opnsense.org) | Firewall/router de código abierto, para la VM del lab | 03 |
| [Kali Linux](https://www.kali.org) | Distro con las herramientas de pentesting | 04 |
| [Suricata](https://suricata.io) | IDS: detecta tráfico sospechoso | 03, 05 |
| [Zeek](https://zeek.org) | Analizador de tráfico que genera logs de todo lo que pasa | 05 |
| [OpenCanary](https://github.com/thinkst/opencanary) | Honeypot interno liviano | 05 |
| [CrowdSec](https://www.crowdsec.net) | Detección y bloqueo de ataques, liviano | 05 |
| [Wazuh](https://wazuh.com) | SIEM completo (pide 4-8 GB de RAM) | 05 |

## Máquinas para atacar (solo en el lab aislado)

| Máquina | Qué es |
|---|---|
| [Metasploitable 2](https://sourceforge.net/projects/metasploitable/) | VM de Linux llena de vulnerabilidades a propósito |
| [DVWA](https://github.com/digininja/DVWA) | App web vulnerable con niveles de dificultad (Docker) |
| [OWASP Juice Shop](https://owasp.org/www-project-juice-shop/) | Tienda web vulnerable con scoreboard de desafíos (Docker) |
| [VulnHub](https://www.vulnhub.com) | Catálogo de VMs vulnerables estilo CTF |

## Rust

| Recurso | Qué es |
|---|---|
| ⭐ [The Rust Book](https://doc.rust-lang.org/book/) | El libro oficial, gratis. El último capítulo es un servidor HTTP con thread pool (proyecto 06). |
| [El libro en español](https://github.com/RustLangES/rust-book-es) | Traducción de la comunidad RustLangES. No oficial y puede estar un poco atrasada respecto del original. |
| [Rustlings](https://github.com/rust-lang/rustlings) | Ejercicios cortos para practicar la sintaxis, en paralelo al libro. |
| [Rust by Example (español)](https://doc.rust-lang.org/rust-by-example/es/) | Conceptos explicados con ejemplos que se pueden correr. |
| [Tutorial de Tokio](https://tokio.rs/tokio/tutorial) | Programación async en Rust (proyectos 02 y 03). |
| ⭐ [dnsguide](https://github.com/EmilHernvall/dnsguide) | Guía paso a paso para hacer un servidor DNS en Rust (proyecto 04). Leer cada capítulo y escribirlo uno mismo, sin copiar. |
| [`std::net`](https://doc.rust-lang.org/std/net/) | Documentación de sockets TCP/UDP de la librería estándar. |
| [pnet](https://docs.rs/pnet) / [pcap](https://docs.rs/pcap) | Crates para leer y armar paquetes a bajo nivel (proyecto 05). |

## Homelab y novedades

| Recurso | Qué es |
|---|---|
| [Self-Host Weekly](https://selfh.st/weekly/) | Newsletter semanal con apps self-hosted nuevas y releases. |
| [Virtualization Howto](https://www.virtualizationhowto.com) | Serie semanal "Home Lab Projects to Try This Weekend". |
| [noted.lol](https://noted.lol) | Reseñas de apps self-hosted. |
| [r/homelab](https://www.reddit.com/r/homelab/), [r/selfhosted](https://www.reddit.com/r/selfhosted/) | Comunidades de home lab. |
| [r/ccna](https://www.reddit.com/r/ccna/) | Comunidad de gente estudiando CCNA (recomiendan mucho a Jeremy's IT Lab). |
| [r/AskNetsec](https://www.reddit.com/r/AskNetsec/) | Preguntas de seguridad. |

## Certificaciones (opcional)

Orden típico, si algún día las quiero:

1. **Network+** o **CCNA**: redes. Jeremy's IT Lab cubre el temario de CCNA.
2. **Security+**: fundamentos de seguridad.
3. **eJPT** o **PNPT**: pentesting práctico.
