# Comandos

Chuleta de comandos para tener a mano. Los `<...>` se reemplazan por lo que corresponda.

## Mi máquina

```powershell
# Windows
ipconfig /all            # IP, máscara, gateway, DNS, MAC
arp -a                   # tabla ARP: IP -> MAC
route print              # tabla de rutas
nslookup google.com      # consulta DNS
tracert google.com       # por qué routers pasa un paquete
netstat -ano             # conexiones y puertos abiertos, con PID
```

```bash
# Linux (server, hub, WSL)
ip -br a                 # IPs de cada interfaz, resumido
ip r                     # tabla de rutas
ip neigh                 # tabla ARP
ss -tlnp                 # puertos TCP escuchando y qué proceso (con sudo)
ss -ulnp                 # lo mismo para UDP
dig google.com           # consulta DNS detallada
dig @<ip-adguard> google.com   # preguntarle a un DNS en particular
traceroute google.com
```

## tcpdump

```bash
sudo tcpdump -i any -n                      # todo, sin resolver nombres
sudo tcpdump -i any -n port 53              # solo DNS
sudo tcpdump -i any -n host <ip>            # solo tráfico de/hacia una IP
sudo tcpdump -i any -n port 1883 -A         # MQTT, mostrando el contenido en texto
sudo tcpdump -i any -n icmp                 # pings
sudo tcpdump -i any -w captura.pcap         # guardar para abrir en Wireshark
```

Las capturas de la red real van en `capturas/` (no se suben a git).

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

Para la fase 02, cuando toque hacerlo con Linux real.

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
