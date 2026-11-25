# Networking

Aprender redes y ciberseguridad haciendo, sobre mi propio home lab. Sin switches físicos: todo lo que haga falta se arma virtual en el server.

## El lab

| Máquina | Para qué |
|---|---|
| **Server** (Debian 13, i5-10400F, 16 GB, KVM) | Labs virtuales (namespaces, containerlab, VMs). Todo lo del lab vive en `/mnt/data/lab`, no en `/` (está casi lleno). |
| **Hub** (Raspberry Pi 5) | Segundo nodo real de la red para capturar y escanear "desde otro lado". |
| **Esta PC** (Windows) | **Packet Tracer** (herramienta principal para redes), Wireshark y las notas. |

Presupuesto de recursos en el server: 2 o 3 VMs prendidas a la vez (quedan ~9 GB de RAM libres); containerlab es liviano.

## Reglas

1. **Solo ataco cosas mías** o donde tengo permiso explícito. Nada de escanear redes ajenas.
2. **El lab va aislado de la red real.** Las máquinas vulnerables (Metasploitable, DVWA, etc.) viven en una red virtual sin salida a la LAN ni a internet.
3. **La red de casa es productiva** (AdGuard es el DNS de todos). Sobre ella solo observo y endurezco; los experimentos que rompen cosas van al lab.
4. **Capturas y escaneos de la red real no se commitean** (`capturas/` y `*.pcap` están en `.gitignore`): pueden tener tráfico y credenciales.

## Hoja de ruta

| Fase | Tema |
|---|---|
| [01](01-fundamentos/) | Fundamentos observando mi propia red: TCP/IP, subredes, DNS, DHCP, ARP, Wireshark, nmap |
| [02](02-redes-virtuales/) | Redes con Packet Tracer (curso CCNA de Jeremy's IT Lab); después, lo mismo con Linux real |
| [03](03-firewall/) | Firewall y segmentación: OPNsense, NAT, WireGuard, Suricata |
| [04](04-ataque/) | Ataque en el lab aislado: Kali, Metasploitable, DVWA, Juice Shop |
| [05](05-defensa/) | Defensa sobre la red real: IDS, honeypot interno, hardening |
| [Código](codigo/) | Redes en Rust: eco TCP, chat, escáner, cliente DNS, lector de capturas, HTTP |

El progreso de cada fase se ve en la web (ver abajo).

El ciclo que más enseña: **atacar algo en el lab → ver cómo se ve desde el lado defensivo → arreglarlo**.

## Recursos

Todo el material (cursos, herramientas, máquinas vulnerables, Rust, homelab) está en [RECURSOS](RECURSOS.md). Para tener a mano: [comandos](referencia/comandos.md) y [subredes](referencia/subredes.md).

Certificaciones, si algún día las quiero: Network+ o CCNA → Security+ → eJPT o PNPT.

## Web

Una web local para leer todo esto y tildar los ejercicios. Los checkboxes se guardan directo en los `.md`, así que el progreso queda en git.

```powershell
.\web.cmd                 # abre http://127.0.0.1:7730
.\web.cmd --port 8000     # otro puerto
```

Solo necesita Python 3 (sin dependencias). Tiene búsqueda en todo el repo (`/` o `Ctrl+K`), índice de cada página, progreso por fase y sección, código con resaltado, y se actualiza sola si editás un `.md` en otro lado.

## Cómo está organizado

- `0X-*/README.md`: ejercicios de cada fase, con checkboxes.
- `02-redes-virtuales/labs/`: archivos de Packet Tracer y topologías reproducibles.
- `codigo/`: workspace de Cargo con un crate por proyecto.
- `referencia/`: chuletas.
- `tools/web/`: la web.
- `notas/`: lo que voy aprendiendo, con mis palabras.
- `capturas/`: pcaps locales (no se suben).
