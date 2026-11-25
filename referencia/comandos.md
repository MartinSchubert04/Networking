# Comandos

Chuleta de comandos para tener a mano. Los `<...>` se reemplazan por lo que corresponda. Casi todo se corre en el server (Debian 13) por SSH.

## Entrar y moverse en el server

```bash
ssh <usuario>@<server>       # desde la PC (PowerShell o Windows Terminal)
tmux new -s lab              # sesión que sobrevive si se corta el SSH
tmux attach -t lab           # volver a la sesión
# dentro de tmux: Ctrl+b d = salir sin cerrar, Ctrl+b c = pestaña nueva, Ctrl+b n = siguiente
cd /mnt/data/lab             # acá va todo lo del lab
```

```bash
scp <usuario>@<server>:/mnt/data/lab/capturas/x.pcap .   # traer un archivo a la PC
scp archivo.txt <usuario>@<server>:/mnt/data/lab/        # mandar un archivo al server
```

## Debian: paquetes, servicios y ayuda

```bash
apt search <algo>            # buscar un paquete
apt show <paquete>           # qué es, de qué depende, cuánto pesa
sudo apt update              # actualizar la lista de paquetes
sudo apt install <paquete>
apt list --installed | grep <algo>
dpkg -L <paquete>            # qué archivos instaló

systemctl status <servicio>  # estado de un servicio
systemctl list-units --type=service --state=running
journalctl -u <servicio> -n 50   # últimos 50 logs de un servicio
journalctl -f                # logs del sistema en vivo

man <comando>                # manual completo
tldr <comando>               # ejemplos cortos (paquete tealdeer)
<comando> --help
```

```bash
whoami; id                   # quién soy y en qué grupos estoy
sudo -l                      # qué puedo hacer con sudo
df -h; du -sh *              # espacio en disco
free -h; htop                # memoria y procesos
docker ps                    # contenedores corriendo y sus puertos
```

## Red: mirar (seguro, no cambia nada)

```bash
ip -br a                     # IPs de cada interfaz, resumido
ip a                         # lo mismo, con MAC y detalles
ip r                         # tabla de rutas (el "default via" es el gateway)
ip neigh                     # tabla ARP
cat /etc/resolv.conf         # qué DNS usa
sudo ss -tlnp                # puertos TCP escuchando y qué proceso
sudo ss -ulnp                # lo mismo para UDP
ss -tn                       # conexiones TCP establecidas
dig google.com               # consulta DNS detallada
dig @<ip-adguard> google.com # preguntarle a un DNS en particular
dig +trace google.com        # resolución completa desde los root servers
traceroute google.com        # por qué routers pasa un paquete
mtr google.com               # traceroute en vivo, con pérdida por salto
nc -zv <ip> <puerto>         # ¿está abierto ese puerto?
curl -v http://<ip>:<puerto> # ver un request HTTP completo
```

En Windows (para comparar): `ipconfig /all`, `arp -a`, `route print`, `nslookup`, `tracert`, `netstat -ano`.

## tcpdump

```bash
sudo tcpdump -i any -n not port 22          # todo menos mi propio SSH
sudo tcpdump -i any -n port 53              # solo DNS
sudo tcpdump -i any -n host <ip>            # solo tráfico de/hacia una IP
sudo tcpdump -i any -n port 1883 -A         # MQTT, mostrando el contenido en texto
sudo tcpdump -i any -n icmp                 # pings
sudo tcpdump -i any -n -c 1000 -w /mnt/data/lab/capturas/dns.pcap port 53   # guardar (máximo 1000 paquetes)
```

Sin el `not port 22`, la captura se llena con el propio tráfico de SSH. Siempre poner un límite (`-c`) al guardar.

## Wireshark en la PC, capturando en el server

Opción 1: guardar en el server y traer el archivo.

```bash
scp <usuario>@<server>:/mnt/data/lab/capturas/dns.pcap .
```

Opción 2: en vivo. El server captura y Wireshark en la PC muestra los paquetes a medida que pasan. Requiere haber instalado `tshark` y estar en el grupo `wireshark` (ver fase 01). Correrlo desde **cmd**, no desde PowerShell (PowerShell viejo rompe los datos binarios en el pipe):

```bat
ssh <usuario>@<server> "dumpcap -q -i enp3s0 -f 'not port 22' -w -" | "C:\Program Files\Wireshark\Wireshark.exe" -k -i -
```

Las capturas en la PC van en `capturas/` del repo (no se suben a git).

## Filtros de Wireshark

```text
dns                          # consultas y respuestas DNS
arp                          # ARP
icmp                         # ping
tcp.flags.syn == 1           # inicios de conexión TCP
tcp.port == 443              # HTTPS
tls.handshake.type == 1      # ClientHello (ahí se ve el SNI)
ip.addr == <ip>              # todo lo de una IP
mqtt                         # MQTT
http                         # HTTP sin cifrar
```

## nmap

Solo contra cosas mías (la LAN de casa o el lab).

```bash
nmap -sn <red>/24            # qué hosts están vivos (sin escanear puertos)
nmap <ip>                    # los 1000 puertos TCP más comunes
nmap -p- <ip>                # todos los puertos TCP (tarda más)
nmap -sV <ip>                # qué servicio y versión hay en cada puerto
nmap -sU --top-ports 20 <ip> # los 20 puertos UDP más comunes (con sudo)
nmap -O <ip>                 # adivinar el sistema operativo (con sudo)
nmap -oN resultado.nmap <ip> # guardar el resultado
```

## Cisco IOS (Packet Tracer)

### Moverse

```text
enable                       # modo privilegiado (Router#)
configure terminal           # modo configuración (Router(config)#)
exit                         # subir un nivel
end                          # volver a Router#
show running-config          # configuración actual
copy running-config startup-config   # guardar
```

### Básico

```text
hostname R1
interface g0/0
 ip address 192.168.1.1 255.255.255.0
 no shutdown
show ip interface brief      # estado e IP de cada interfaz
show ip route                # tabla de rutas
```

### VLANs y trunk (switch)

```text
vlan 10
 name USUARIOS
vlan 20
 name IOT
interface f0/1
 switchport mode access
 switchport access vlan 10
interface g0/1
 switchport mode trunk
show vlan brief
show interfaces trunk
```

### Router-on-a-stick (inter-VLAN routing)

```text
interface g0/0
 no shutdown
interface g0/0.10
 encapsulation dot1Q 10
 ip address 192.168.10.1 255.255.255.0
interface g0/0.20
 encapsulation dot1Q 20
 ip address 192.168.20.1 255.255.255.0
```

### DHCP en el router

```text
ip dhcp excluded-address 192.168.10.1 192.168.10.10
ip dhcp pool USUARIOS
 network 192.168.10.0 255.255.255.0
 default-router 192.168.10.1
 dns-server 8.8.8.8
show ip dhcp binding
```

### Ruta estática

```text
ip route 192.168.30.0 255.255.255.0 10.0.0.2
```

## Network namespaces (Linux)

Para la fase 02, cuando toque hacerlo con Linux real. Es la forma segura de experimentar en el server: todo pasa dentro de "PCs" virtuales y no toca `enp3s0` ni el firewall de Docker.

```bash
sudo ip netns add pc1                       # crear una "PC"
sudo ip link add veth1 type veth peer name veth1-br   # un "cable" con dos puntas
sudo ip link set veth1 netns pc1            # enchufar una punta en la PC
sudo ip netns exec pc1 ip addr add 10.0.0.1/24 dev veth1
sudo ip netns exec pc1 ip link set veth1 up
sudo ip link add br0 type bridge            # un "switch"
sudo ip link set veth1-br master br0        # enchufar la otra punta al switch
sudo ip link set br0 up
sudo ip link set veth1-br up
sudo ip netns exec pc1 ping 10.0.0.2        # probar
sudo ip netns del pc1                       # borrar
```
