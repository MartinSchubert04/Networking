# 02 · Redes virtuales sin hardware

Objetivo: construir switches, routers y redes con software, pieza por pieza, para entender capa 2 y capa 3.

Todo corre en el server, en `/mnt/data/lab`. Los scripts y topologías quedan en `labs/` para poder reconstruirlos.

## A. Network namespaces (a mano, con `ip`)

- [ ] Dos "PCs" (namespaces) unidas por un cable (par `veth`) y que se hagan ping
- [ ] Tres PCs unidas por un "switch" (un `bridge` de Linux)
- [ ] Ver la tabla MAC del switch (`bridge fdb`) y cómo aprende
- [ ] Un router entre dos subredes: namespace con dos interfaces y `ip_forward`
- [ ] NAT: que una subred "privada" salga a través del router (`iptables`/`nftables` masquerade)
- [ ] VLANs en el bridge (`vlan_filtering`): dos VLANs en el mismo switch que no se ven entre sí
- [ ] Router-on-a-stick: una sola interfaz con subinterfaces por VLAN

## B. Containerlab

Topologías declarativas en YAML con routers reales en contenedores.

- [ ] Instalar containerlab en el server
- [ ] Lab de dos routers FRRouting con rutas estáticas
- [ ] OSPF entre tres routers; tirar un enlace y ver cómo converge
- [ ] BGP entre dos "sistemas autónomos"
- [ ] Capturar tráfico entre routers del lab con Wireshark (por SSH al server)

## C. Packet Tracer / GNS3 (en la PC)

- [ ] VLANs y trunk entre dos switches Cisco
- [ ] Inter-VLAN routing
- [ ] DHCP en el router
- [ ] ACLs básicas

## Qué aprendí

(completar al terminar la fase)
