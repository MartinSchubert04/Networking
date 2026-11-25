# Networking

Aprender redes y ciberseguridad haciendo, sobre mi propio home lab. Sin switches físicos: todo lo que haga falta se arma virtual en el server.

## El lab

| Máquina | Para qué |
|---|---|
| **Server** (Debian 13, i5-10400F, 16 GB, KVM) | Labs virtuales (namespaces, containerlab, VMs). Todo lo del lab vive en `/mnt/data/lab`, no en `/` (está casi lleno). |
| **Hub** (Raspberry Pi 5) | Segundo nodo real de la red para capturar y escanear "desde otro lado". |
| **Esta PC** (Windows) | Wireshark, Packet Tracer, GNS3 (ya instalado) y las notas. |

Presupuesto de recursos en el server: 2 o 3 VMs prendidas a la vez (quedan ~9 GB de RAM libres); containerlab es liviano.

## Reglas

1. **Solo ataco cosas mías** o donde tengo permiso explícito. Nada de escanear redes ajenas.
2. **El lab va aislado de la red real.** Las máquinas vulnerables (Metasploitable, DVWA, etc.) viven en una red virtual sin salida a la LAN ni a internet.
3. **La red de casa es productiva** (AdGuard es el DNS de todos). Sobre ella solo observo y endurezco; los experimentos que rompen cosas van al lab.
4. **Capturas y escaneos de la red real no se commitean** (`capturas/` y `*.pcap` están en `.gitignore`): pueden tener tráfico y credenciales.

## Hoja de ruta

| Fase | Tema | Estado |
|---|---|---|
| [01](01-fundamentos/) | Fundamentos observando mi propia red: TCP/IP, subredes, DNS, DHCP, ARP, Wireshark, nmap | ⬜ |
| [02](02-redes-virtuales/) | Redes virtuales sin hardware: namespaces, bridges, VLANs, routing, containerlab | ⬜ |
| [03](03-firewall/) | Firewall y segmentación: OPNsense, NAT, WireGuard, Suricata | ⬜ |
| [04](04-ataque/) | Ataque en el lab aislado: Kali, Metasploitable, DVWA, Juice Shop | ⬜ |
| [05](05-defensa/) | Defensa sobre la red real: IDS, honeypot interno, hardening | ⬜ |

El ciclo que más enseña: **atacar algo en el lab → ver cómo se ve desde el lado defensivo → arreglarlo**.

## En paralelo

- [TryHackMe](https://tryhackme.com): caminos *Pre Security* y después *Jr Penetration Tester*.
- [OverTheWire Bandit](https://overthewire.org/wargames/bandit/): soltura con Linux.
- [PicoCTF](https://picoctf.org): CTFs para principiantes.
- Cisco Packet Tracer (gratis con cuenta de NetAcad) para la parte estilo CCNA.

Certificaciones, si algún día las quiero: Network+ o CCNA → Security+ → eJPT o PNPT.

## Cómo está organizado

- `0X-*/README.md`: ejercicios de cada fase, con checkboxes.
- `02-redes-virtuales/labs/`: topologías y scripts reproducibles.
- `notas/`: lo que voy aprendiendo, con mis palabras.
- `capturas/`: pcaps locales (no se suben).
