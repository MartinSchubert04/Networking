# 01 · Fundamentos observando mi propia red

Objetivo: entender qué pasa en mi red real, mirándola, antes de construir nada.

## Teoría mínima

- [ ] Modelo TCP/IP (y OSI, para entender de qué habla todo el mundo)
- [ ] Direcciones IP, máscaras y subredes (CIDR: qué significa `/24`, cuántos hosts entran)
- [ ] MAC y ARP: cómo una IP se convierte en una dirección física
- [ ] DHCP: cómo un dispositivo consigue su IP
- [ ] DNS: cómo un nombre se convierte en IP
- [ ] TCP vs UDP, puertos, el handshake de TCP
- [ ] Gateway y routing: cómo sale un paquete a otra red

## Ejercicios

### Mi máquina
- [ ] Ver mi IP, máscara, gateway y DNS (`ipconfig /all` en Windows, `ip a` / `ip r` en Linux)
- [ ] Ver la tabla ARP (`arp -a`) y entender cada entrada
- [ ] Ver qué puertos escucha el server (`ss -tlnp`) y qué proceso es cada uno

### Wireshark / tcpdump
- [ ] Capturar un `ping` y encontrar el ARP previo y los ICMP
- [ ] Capturar una consulta DNS (filtro `dns`) y su respuesta
- [ ] Capturar el handshake TCP (SYN, SYN-ACK, ACK) de una conexión HTTP
- [ ] Capturar una conexión HTTPS y ver qué se ve (SNI en el ClientHello) y qué no
- [ ] **MQTT en texto plano:** capturar el puerto 1883 en el server (`tcpdump -i any port 1883 -A`) y leer los mensajes de los sensores. Anotar por qué esto es un problema.

### DNS con AdGuard
- [ ] Mirar el registro de consultas: qué dispositivos hay y con quién hablan
- [ ] Encontrar el dispositivo más "charlatán" y averiguar por qué
- [ ] Cruzar una consulta del registro con lo que se ve en una captura

### nmap contra mi LAN
- [ ] Descubrir hosts (`nmap -sn <red>/24`) y armar el inventario en `notas/inventario.md` (local)
- [ ] Escanear puertos del server (`nmap -sV <ip-server>`) y explicar cada puerto abierto
- [ ] Para cada servicio expuesto en todas las interfaces: ¿pide login? ¿acepta conexiones anónimas? ¿necesita estar en la LAN o alcanza con localhost/Tailscale?

### Problema real
- [ ] El ESP32 `bmp280-esp32-c3` está en `192.168.1.x` y el resto de la red en `192.168.0.x`. ¿Por qué? ¿Por qué Home Assistant no llega? ¿Cómo se arregla?

## Qué aprendí

(completar al terminar la fase)
