document.addEventListener('DOMContentLoaded', function () {
  // --- 1. Live Glossary Search (Whole-Word Boundary) ---
  var glossarySearch = document.getElementById('glossarySearch');
  var glossaryNoResults = document.getElementById('glossaryNoResults');
  var glossaryAssur = document.getElementById('glossaryAssur');

  function filterGlossary() {
    if (!glossarySearch) return;
    var query = glossarySearch.value.trim();
    var cards = glossaryAssur.querySelectorAll('.term-card');
    var cats = glossaryAssur.querySelectorAll('.glossary-cat');
    var visibleCount = 0;

    if (!query) {
      cards.forEach(function (c) { c.classList.remove('hidden'); });
      cats.forEach(function (cat) { cat.classList.remove('hidden'); });
      if (glossaryNoResults) glossaryNoResults.classList.add('hidden');
      return;
    }

    var escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var regex = new RegExp('\\b' + escaped, 'i');

    cards.forEach(function (card) {
      var match = regex.test(card.textContent);
      card.classList.toggle('hidden', !match);
      if (match) visibleCount++;
    });

    cats.forEach(function (cat) {
      var next = cat.nextElementSibling;
      var hasVisible = false;
      while (next && !next.classList.contains('glossary-cat')) {
        if (next.classList.contains('term-card') && !next.classList.contains('hidden')) {
          hasVisible = true;
          break;
        }
        next = next.nextElementSibling;
      }
      cat.classList.toggle('hidden', !hasVisible);
    });

    if (glossaryNoResults) {
      glossaryNoResults.classList.toggle('hidden', visibleCount > 0);
    }
  }

  if (glossarySearch) {
    glossarySearch.addEventListener('input', filterGlossary);
  }

  // --- 2. Top Tab Switcher ---
  var tabSyslog = document.getElementById('tabSyslog');
  var tabSpan = document.getElementById('tabSpan');
  var tabNetflow = document.getElementById('tabNetflow');
  var panelSyslog = document.getElementById('panelSyslog');
  var panelSpan = document.getElementById('panelSpan');
  var panelNetflow = document.getElementById('panelNetflow');

  function activateTab(activeBtn, activePanel) {
    [tabSyslog, tabSpan, tabNetflow].forEach(function (t) { t.classList.remove('active'); });
    [panelSyslog, panelSpan, panelNetflow].forEach(function (p) { p.classList.add('hidden'); });
    activeBtn.classList.add('active');
    activePanel.classList.remove('hidden');
  }

  tabSyslog.addEventListener('click', function () { activateTab(tabSyslog, panelSyslog); });
  tabSpan.addEventListener('click', function () { activateTab(tabSpan, panelSpan); });
  tabNetflow.addEventListener('click', function () { activateTab(tabNetflow, panelNetflow); });

  // --- 3. Syslog Severity Levels (0–7) Simulator ---
  var syslogEvents = [
    { level: 0, name: 'Emergencies', msg: '%SYS-0-SYSTEM_HALT: System unusable — kernel panic triggered' },
    { level: 1, name: 'Alerts', msg: '%ENV-1-TEMP_CRIT: Immediate action needed — chassis temperature 88°C' },
    { level: 2, name: 'Critical', msg: '%SYS-2-MALLOCFAIL: Critical memory allocation failure in I/O pool' },
    { level: 3, name: 'Errors', msg: '%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down' },
    { level: 4, name: 'Warnings', msg: '%OSPF-4-ERRRCV: Received invalid OSPF packet from 10.10.1.2 (Area mismatch)' },
    { level: 5, name: 'Notifications', msg: '%SYS-5-CONFIG_I: Configured from console by admin on vty0 (10.10.50.10)' },
    { level: 6, name: 'Informational', msg: '%SEC_LOGIN-5-LOGIN_SUCCESS: Normal operational event / ACL hit logged' },
    { level: 7, name: 'Debugging', msg: '%OSPF-7-ADJ: OSPF: Send Hello to 224.0.0.5 area 0 on GigabitEthernet0/0' }
  ];

  var trapSelect = document.getElementById('syslogTrapSelect');

  function renderSyslog() {
    var maxLevel = parseInt(trapSelect.value, 10);
    var sentCount = maxLevel + 1;

    document.getElementById('syslogSummary').textContent =
      'Active CLI: "logging trap ' + maxLevel + '" → Forwarding ' + sentCount +
      ' of 8 severity levels (Levels 0 through ' + maxLevel + ') to Syslog Server (UDP 514).';

    document.getElementById('syslogList').innerHTML = syslogEvents.map(function (ev) {
      var isSent = ev.level <= maxLevel;
      return '<div class="sys-row ' + (isSent ? 'is-sent' : 'is-dropped') + '">' +
        '<div class="sys-left">' +
        '<span class="sys-title">Level ' + ev.level + ' — ' + ev.name + '</span>' +
        '<span class="sys-msg">' + ev.msg + '</span>' +
        '</div>' +
        '<span class="sys-badge ' + (isSent ? 'badge-sent' : 'badge-drop') + '">' +
        (isSent ? 'SENT TO SERVER' : 'FILTERED OUT') +
        '</span>' +
        '</div>';
    }).join('');
  }

  trapSelect.addEventListener('change', renderSyslog);
  // --- 4. SPAN / RSPAN / ERSPAN Visualizer ---
  var spanModes = {
    'span': {
      scope: 'Local Switch Only',
      transport: 'Internal Switch Backplane',
      encap: 'Original Ethernet Frame (Unmodified)',
      explain: 'Local SPAN copies ingress/egress frames from source ports or VLANs directly to a local destination analyzer port on the exact same switch. Destination ports stop normal switching unless "ingress" is configured.',
      cli: '! Local SPAN on Switch-1\nmonitor session 1 source interface GigabitEthernet1/0/1 both\nmonitor session 1 destination interface GigabitEthernet1/0/24'
    },
    'rspan': {
      scope: 'Multi-Switch Layer 2 Domain',
      transport: '802.1Q Layer 2 Trunk Links',
      encap: '802.1Q Tag with Dedicated RSPAN VLAN ID',
      explain: 'Remote SPAN (RSPAN) carries mirrored frames across intermediate Layer 2 switches using a special VLAN configured with the "remote-span" keyword (which disables MAC address learning on that VLAN).',
      cli: '! Step 1: On ALL switches (Source, Intermediate, Destination)\nvlan 999\n name RSPAN-VLAN\n remote-span\n!\n! Step 2: Source Switch\nmonitor session 1 source interface GigabitEthernet1/0/1 both\nmonitor session 1 destination remote vlan 999\n!\n! Step 3: Destination Switch\nmonitor session 1 source remote vlan 999\nmonitor session 1 destination interface GigabitEthernet1/0/24'
    },
    'erspan': {
      scope: 'Across Layer 3 Routed IP Networks',
      transport: 'GRE Tunnel (IP Protocol 47)',
      encap: 'Outer IP + GRE Header + Original Frame',
      explain: 'Encapsulated Remote SPAN (ERSPAN) wraps mirrored Layer 2 frames inside a GRE tunnel so packets can traverse Layer 3 routers to reach a centralized packet analyzer anywhere in the enterprise.',
      cli: '! Source Switch (ERSPAN Origin)\nmonitor session 1 type erspan-source\n source interface GigabitEthernet1/0/1 both\n no shutdown\n destination\n  erspan-id 101\n  ip address 10.99.99.50\n  origin ip address 10.10.1.1'
    }
  };

  var spanSelect = document.getElementById('spanSelect');
  function renderSpan() {
    var item = spanModes[spanSelect.value];
    document.getElementById('spanMetrics').innerHTML =
      '<div class="metric-pill"><span>Reachability Scope</span><strong>' + item.scope + '</strong></div>' +
      '<div class="metric-pill"><span>Transport Medium</span><strong>' + item.transport + '</strong></div>' +
      '<div class="metric-pill"><span>Frame Encapsulation</span><strong>' + item.encap + '</strong></div>';
    document.getElementById('spanExplain').textContent = item.explain;
    document.getElementById('spanCli').textContent = item.cli;
  }
  spanSelect.addEventListener('change', renderSpan);

  // --- 5. Flexible NetFlow (FNF) Building Blocks ---
  var nfBlocks = [
    {
      label: '1. Flow Record (What to Collect)',
      explain: 'Defines the <strong>Key Fields</strong> used to group packets into a unique flow (Src/Dst IPv4, Src/Dst L4 Ports, IP Protocol, ToS, Input Interface) and <strong>Non-Key Fields</strong> collected as metrics (packet count, byte count, timestamps).',
      cli: 'flow record ENCOR-RECORD\n description Match 7-tuple IPv4 flows\n match ipv4 source address\n match ipv4 destination address\n match ipv4 protocol\n match transport source-port\n match transport destination-port\n match interface input\n collect counter bytes long\n collect counter packets long\n collect timestamp sys-uptime first\n collect timestamp sys-uptime last'
    },
    {
      label: '2. Flow Exporter (Where to Send)',
      explain: 'Defines the external NetFlow collector IP address, UDP destination port (typically <code>2055</code> or <code>9995</code>), export protocol version (NetFlow v9 or IPFIX), and the local source loopback interface.',
      cli: 'flow exporter ENCOR-EXPORTER\n description Export IPFIX telemetry to collector\n destination 10.10.99.50\n source Loopback0\n transport udp 2055\n export-protocol ipfix'
    },
    {
      label: '3. Flow Monitor (Bind & Apply)',
      explain: 'Ties the <strong>Flow Record</strong> and <strong>Flow Exporter</strong> together into an active cache, and is applied inbound or outbound on a router interface using <code>ip flow monitor</code>.',
      cli: 'flow monitor ENCOR-MONITOR\n record ENCOR-RECORD\n exporter ENCOR-EXPORTER\n cache timeout active 60\n!\ninterface GigabitEthernet0/0\n ip flow monitor ENCOR-MONITOR input'
    }
  ];

  var nfPills = document.getElementById('nfPills');
  var nfExplain = document.getElementById('nfExplain');
  var nfCli = document.getElementById('nfCli');

  nfBlocks.forEach(function (blk, idx) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nf-pill' + (idx === 0 ? ' active' : '');
    btn.textContent = blk.label;
    btn.addEventListener('click', function () {
      nfPills.querySelectorAll('.nf-pill').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      nfExplain.innerHTML = blk.explain;
      nfCli.textContent = blk.cli;
    });
    nfPills.appendChild(btn);
  });

  nfExplain.innerHTML = nfBlocks[0].explain;
  nfCli.textContent = nfBlocks[0].cli;

  // Close parent modal on Esc key when embedded in 4any1
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && window.parent !== window) {
      window.parent.postMessage('closeAssuranceModal', '*');
    }
  });

  renderSyslog();
  renderSpan();
});
