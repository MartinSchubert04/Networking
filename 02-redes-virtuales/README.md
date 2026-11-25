# 02 · Redes virtuales sin hardware

Objetivo: construir switches, routers y redes con software, pieza por pieza, para entender capa 2 y capa 3.

La herramienta principal es **Cisco Packet Tracer** en la PC, siguiendo el curso gratis de CCNA de Jeremy's IT Lab. Los archivos `.pkt` de cada práctica se guardan en `labs/`. Los namespaces y containerlab (en el server, en `/mnt/data/lab`) quedan para después, cuando quiera ver lo mismo con Linux real.

## Packet Tracer (principal)

Material:
- **Packet Tracer:** se descarga gratis desde [NetAcad](https://www.netacad.com) con una cuenta gratuita (sección Resources). Solo de ahí, no de sitios de terceros.
- **Curso:** *Free CCNA 200-301 Complete Course* de **Jeremy's IT Lab** en YouTube. Cada "Day" tiene un video de teoría y otro de laboratorio; los archivos de los labs se bajan desde la descripción de los videos.
- **Complemento:** en NetAcad, los cursos gratis *Getting Started with Cisco Packet Tracer* y *Exploring Networking with Cisco Packet Tracer*.

Ejercicios:
- [ ] Getting Started with Cisco Packet Tracer (NetAcad)
- [ ] Jeremy's IT Lab: hacer cada Day con su lab, en orden
- [ ] VLANs y trunk entre dos switches
- [ ] Inter-VLAN routing
- [ ] DHCP en el router
- [ ] ACLs básicas
- [ ] Usar el **modo simulación** para seguir un paquete paso a paso (ARP, DNS, TCP)

## Después: lo mismo con Linux real

### A. Network namespaces (a mano, con `ip`)

- [ ] Dos "PCs" (namespaces) unidas por un cable (par `veth`) y que se hagan ping
- [ ] Tres PCs unidas por un "switch" (un `bridge` de Linux)
- [ ] Ver la tabla MAC del switch (`bridge fdb`) y cómo aprende
- [ ] Un router entre dos subredes: namespace con dos interfaces y `ip_forward`
- [ ] NAT: que una subred "privada" salga a través del router (`iptables`/`nftables` masquerade)
- [ ] VLANs en el bridge (`vlan_filtering`): dos VLANs en el mismo switch que no se ven entre sí
- [ ] Router-on-a-stick: una sola interfaz con subinterfaces por VLAN

### B. Containerlab

Topologías declarativas en YAML con routers reales en contenedores.

- [ ] Instalar containerlab en el server
- [ ] Lab de dos routers FRRouting con rutas estáticas
- [ ] OSPF entre tres routers; tirar un enlace y ver cómo converge
- [ ] BGP entre dos "sistemas autónomos"
- [ ] Capturar tráfico entre routers del lab con Wireshark (por SSH al server)

## Qué aprendí

(completar al terminar la fase)
