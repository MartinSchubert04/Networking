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

## Preparar el server

Los comandos se corren en el server (Debian 13), por SSH desde la PC. Antes, leer las [reglas del server](../README.md#reglas-para-el-server).

- [ ] Entrar por SSH desde la PC (`ssh <usuario>@<server>`) y abrir una sesión de `tmux` para que no se corte si se cae la conexión
- [ ] Crear la carpeta del lab: `mkdir -p /mnt/data/lab/capturas`
- [ ] Entender qué hace `apt` antes de usarlo: `apt search`, `apt show tcpdump`, `apt policy nmap`
- [ ] Instalar las herramientas: `sudo apt update && sudo apt install tcpdump nmap tshark mtr-tiny iperf3 tmux tealdeer` (después `tldr --update` para bajar los ejemplos)
- [ ] Al instalar `tshark`, aceptar que usuarios sin root puedan capturar, y agregarme al grupo: `sudo usermod -aG wireshark $USER` (después, salir y volver a entrar)
- [ ] Aprender a pedir ayuda: `man ss`, `tldr tcpdump`, `ss --help`

## Ejercicios

### El server
- [ ] Ver IP, máscara y MAC de cada interfaz (`ip -br a`, `ip a`) y entender qué es cada una (`lo`, `enp3s0`, `docker0`, `tailscale0`, los `veth`)
- [ ] Ver la tabla de rutas (`ip r`) y encontrar el gateway
- [ ] Ver qué DNS usa (`cat /etc/resolv.conf`)
- [ ] Ver la tabla ARP (`ip neigh`) y entender cada entrada
- [ ] Ver qué puertos escucha (`sudo ss -tlnp` y `sudo ss -ulnp`) y qué proceso o contenedor es cada uno (`docker ps`)
- [ ] Ver los servicios del sistema (`systemctl list-units --type=service --state=running`) y los logs de uno (`journalctl -u tailscaled -n 50`)
- [ ] Repetir los primeros tres desde la PC (`ipconfig /all`, `arp -a`, `route print`) y comparar

### Wireshark / tcpdump
Capturar en el server con `tcpdump` y abrir los `.pcap` con Wireshark en la PC (ver [comandos](../referencia/comandos.md#wireshark-en-la-pc-capturando-en-el-server)).

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
