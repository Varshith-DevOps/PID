import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

const _bg = Color(0xFF0B1020);
const _panel = Color(0xFF111827);
const _panelSoft = Color(0xFF172033);
const _line = Color(0xFF263247);
const _text = Color(0xFFE5E7EB);
const _muted = Color(0xFF94A3B8);
const _teal = Color(0xFF2DD4BF);
const _amber = Color(0xFFF59E0B);
const _rose = Color(0xFFFB7185);
const _indigo = Color(0xFF818CF8);

List<dynamic> _list(dynamic value) {
  if (value is List) return value;
  if (value is Map && value['data'] is List) return value['data'];
  if (value is Map && value['items'] is List) return value['items'];
  if (value is Map && value['timesheets'] is List) return value['timesheets'];
  return [];
}

Map<String, dynamic> _map(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : {};

double _num(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

String _date(dynamic value) {
  if (value == null) return '-';
  final parsed = DateTime.tryParse(value.toString());
  if (parsed == null) return value.toString();
  return DateFormat('dd MMM').format(parsed.toLocal());
}

String _dateInput(DateTime value) => DateFormat('yyyy-MM-dd').format(value);

String _money(dynamic value) {
  final amount = _num(value);
  final formatter = NumberFormat.currency(locale: 'en_IN', symbol: 'Rs ', decimalDigits: 0);
  return formatter.format(amount);
}

class EmployeeHomeScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const EmployeeHomeScreen({super.key, required this.authProvider});

  @override
  State<EmployeeHomeScreen> createState() => _EmployeeHomeScreenState();
}

class _EmployeeHomeScreenState extends State<EmployeeHomeScreen> {
  bool _loading = true;
  String? _message;
  Map<String, dynamic> _dashboard = {};
  List<dynamic> _notifications = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final results = await Future.wait([
        ApiService.getJson('/dashboard/me'),
        ApiService.getJson('/notifications?unreadOnly=true'),
      ]);
      if (!mounted) return;
      setState(() {
        _dashboard = _map(results[0]);
        _notifications = _list(results[1]);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = _map(_dashboard['user']);
    final focus = _map(_dashboard['focus']);
    final cards = _map(_dashboard['cards']);
    final organization = _map(_dashboard['organization']);
    final name = user['name']?.toString() ?? widget.authProvider.displayName;
    final title = user['title']?.toString() ?? widget.authProvider.role ?? 'Employee';
    final weeklyHours = _num(focus['weeklyHours']);
    final leaveBalance = _num(focus['leaveBalance']);
    final assignedTasks = _num(focus['assignedTasks']);
    final attendanceStatus = focus['attendanceStatus']?.toString() ?? 'NOT_MARKED';

    return _ScreenFrame(
      onRefresh: _load,
      loading: _loading,
      title: 'Today',
      subtitle: 'Your workday, priorities, and team signals',
      message: _message,
      children: [
        _HeroPanel(
          name: name,
          title: title,
          status: attendanceStatus,
          unread: _notifications.length,
        ),
        _MetricGrid(children: [
          _InsightMetric(
            icon: Icons.timer_outlined,
            label: 'Weekly hours',
            value: weeklyHours.toStringAsFixed(1),
            accent: _teal,
            insight: weeklyHours >= 36
                ? 'Great consistency. Your weekly hours are on track.'
                : 'Try logging time daily so project effort stays accurate.',
          ),
          _InsightMetric(
            icon: Icons.event_available_outlined,
            label: 'Leave balance',
            value: leaveBalance.toStringAsFixed(0),
            accent: _amber,
            insight: leaveBalance >= 5
                ? 'Healthy balance. You can plan time off without stress.'
                : 'Leave balance is low. Check with HR before planning long leave.',
          ),
          _InsightMetric(
            icon: Icons.task_alt_outlined,
            label: 'Open tasks',
            value: assignedTasks.toStringAsFixed(0),
            accent: _indigo,
            insight: assignedTasks <= 4
                ? 'Nice focus. Your assigned workload looks manageable.'
                : 'You have several open tasks. Prioritize blocked or due items first.',
          ),
          _InsightMetric(
            icon: Icons.groups_2_outlined,
            label: 'Team present',
            value: '${_num(organization['attendanceRate']).toStringAsFixed(0)}%',
            accent: _rose,
            insight: 'Use team availability before booking meetings or handoffs.',
          ),
        ]),
        _Section(title: 'Quick actions', child: _QuickActions(actions: [
          _ActionItem(Icons.login_rounded, 'Check in/out', 'Use Time tab', _teal),
          _ActionItem(Icons.edit_calendar_outlined, 'Apply leave', 'Use Leave tab', _amber),
          _ActionItem(Icons.receipt_long_outlined, 'Claim expense', 'Use Money tab', _rose),
          _ActionItem(Icons.support_agent_outlined, 'Raise ticket', 'Use More tab', _indigo),
        ])),
        _Section(
          title: 'Assigned projects',
          child: _ProjectList(projects: _list(cards['projects'])),
        ),
        _Section(
          title: 'Team availability',
          child: _AvailabilityList(people: _list(cards['teamAvailability'])),
        ),
        _Section(
          title: 'Upcoming birthdays',
          child: _BirthdayList(items: _list(cards['birthdays'])),
        ),
      ],
    );
  }
}

class EmployeeTimeScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const EmployeeTimeScreen({super.key, required this.authProvider});

  @override
  State<EmployeeTimeScreen> createState() => _EmployeeTimeScreenState();
}

class _EmployeeTimeScreenState extends State<EmployeeTimeScreen> {
  bool _loading = true;
  String? _message;
  List<dynamic> _todayAttendance = [];
  List<dynamic> _tasks = [];
  List<dynamic> _timesheets = [];
  List<dynamic> _overtime = [];

  String? get _employeeId => widget.authProvider.employeeId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final employeeId = _employeeId;
      final results = await Future.wait([
        ApiService.getJson('/attendance/today'),
        if (employeeId != null) ApiService.getJson('/projects/tasks/all?assigneeId=$employeeId') else Future.value([]),
        if (employeeId != null) ApiService.getJson('/timesheet/employee/$employeeId') else Future.value({}),
        if (employeeId != null) ApiService.getJson('/overtime?employeeId=$employeeId') else Future.value([]),
      ]);
      if (!mounted) return;
      setState(() {
        _todayAttendance = _list(results[0]);
        _tasks = _list(results[1]);
        _timesheets = _list(results[2]);
        _overtime = _list(results[3]);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _attendanceAction(bool checkIn) async {
    final employeeId = _employeeId;
    if (employeeId == null) {
      _toast('Employee profile is not linked to this login.');
      return;
    }
    try {
      await ApiService.postJson(checkIn ? '/attendance/check-in' : '/attendance/check-out', {'employeeId': employeeId});
      _toast(checkIn ? 'Checked in successfully.' : 'Checked out successfully.');
      _load();
    } catch (e) {
      _toast(e.toString(), error: true);
    }
  }

  Future<void> _openTimesheetDialog() async {
    final employeeId = _employeeId;
    if (employeeId == null) {
      _toast('Employee profile is not linked to this login.', error: true);
      return;
    }
    final hours = TextEditingController(text: '8');
    final description = TextEditingController();
    String? taskId = _tasks.isNotEmpty ? _map(_tasks.first)['id']?.toString() : null;
    DateTime selectedDate = DateTime.now();

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _panel,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => _SheetForm(
          title: 'Log timesheet',
          children: [
            _FieldLabel('Task'),
            DropdownButtonFormField<String?>(
              value: taskId,
              dropdownColor: _panel,
              decoration: _inputDecoration('Select a task'),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('General work')),
                ..._tasks.map((task) {
                  final item = _map(task);
                  return DropdownMenuItem<String?>(
                    value: item['id']?.toString(),
                    child: Text(item['title']?.toString() ?? 'Task'),
                  );
                }),
              ],
              onChanged: (value) => setSheetState(() => taskId = value),
            ),
            const SizedBox(height: 12),
            _FieldLabel('Hours'),
            TextField(controller: hours, keyboardType: TextInputType.number, decoration: _inputDecoration('Hours worked')),
            const SizedBox(height: 12),
            _FieldLabel('Work note'),
            TextField(controller: description, minLines: 2, maxLines: 3, decoration: _inputDecoration('What did you complete?')),
            const SizedBox(height: 12),
            _DateButton(
              label: 'Date: ${DateFormat('dd MMM yyyy').format(selectedDate)}',
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: selectedDate,
                  firstDate: DateTime.now().subtract(const Duration(days: 30)),
                  lastDate: DateTime.now(),
                );
                if (picked != null) setSheetState(() => selectedDate = picked);
              },
            ),
            _PrimaryButton(
              label: 'Save timesheet',
              icon: Icons.save_outlined,
              onPressed: () async {
                try {
                  await ApiService.postJson('/timesheet', {
                    'employeeId': employeeId,
                    'taskId': taskId,
                    'date': _dateInput(selectedDate),
                    'hoursWorked': double.tryParse(hours.text) ?? 0,
                    'description': description.text.trim(),
                  });
                  if (context.mounted) Navigator.pop(context, true);
                } catch (e) {
                  _toast(e.toString(), error: true);
                }
              },
            ),
          ],
        ),
      ),
    );

    if (saved == true) {
      _toast('Timesheet saved.');
      _load();
    }
  }

  void _toast(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(text),
      backgroundColor: error ? _rose : _teal,
    ));
  }

  @override
  Widget build(BuildContext context) {
    return _ScreenFrame(
      onRefresh: _load,
      loading: _loading,
      title: 'Time',
      subtitle: 'Attendance, tasks, timesheets, and overtime',
      message: _message,
      children: [
        _Section(
          title: 'Attendance actions',
          child: Row(
            children: [
              Expanded(child: _PrimaryButton(label: 'Check in', icon: Icons.login_rounded, onPressed: () => _attendanceAction(true))),
              const SizedBox(width: 10),
              Expanded(child: _SecondaryButton(label: 'Check out', icon: Icons.logout_rounded, onPressed: () => _attendanceAction(false))),
            ],
          ),
        ),
        _Section(
          title: 'Today attendance',
          child: _AttendanceList(items: _todayAttendance),
        ),
        _Section(
          title: 'My tasks',
          action: TextButton.icon(
            onPressed: _openTimesheetDialog,
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Log time'),
          ),
          child: _TaskList(items: _tasks),
        ),
        _Section(title: 'Recent timesheets', child: _TimesheetList(items: _timesheets)),
        _Section(title: 'Overtime', child: _SimpleList(items: _overtime, empty: 'No overtime requests yet.', titleKey: 'status', subtitleKey: 'date')),
      ],
    );
  }
}

class EmployeeLeaveScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const EmployeeLeaveScreen({super.key, required this.authProvider});

  @override
  State<EmployeeLeaveScreen> createState() => _EmployeeLeaveScreenState();
}

class _EmployeeLeaveScreenState extends State<EmployeeLeaveScreen> {
  bool _loading = true;
  String? _message;
  List<dynamic> _requests = [];
  List<dynamic> _balances = [];
  List<dynamic> _regularizations = [];

  String? get _employeeId => widget.authProvider.employeeId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final employeeId = _employeeId;
      final results = await Future.wait([
        ApiService.getJson('/leave/my'),
        if (employeeId != null) ApiService.getJson('/leave/balance?employeeId=$employeeId') else Future.value([]),
        ApiService.getJson('/regularizations'),
      ]);
      if (!mounted) return;
      setState(() {
        _requests = _list(results[0]);
        _balances = _list(results[1]);
        _regularizations = _list(results[2]);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openLeaveDialog() async {
    final employeeId = _employeeId;
    if (employeeId == null) {
      _toast('Employee profile is not linked to this login.', error: true);
      return;
    }
    String leaveType = 'CASUAL';
    DateTime start = DateTime.now().add(const Duration(days: 1));
    DateTime end = DateTime.now().add(const Duration(days: 1));
    final reason = TextEditingController();

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _panel,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => _SheetForm(
          title: 'Apply leave',
          children: [
            _FieldLabel('Leave type'),
            DropdownButtonFormField<String>(
              value: leaveType,
              dropdownColor: _panel,
              decoration: _inputDecoration('Leave type'),
              items: const ['CASUAL', 'SICK', 'EARNED', 'UNPAID']
                  .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                  .toList(),
              onChanged: (value) => setSheetState(() => leaveType = value ?? leaveType),
            ),
            const SizedBox(height: 12),
            _DateButton(
              label: 'Start: ${DateFormat('dd MMM yyyy').format(start)}',
              onTap: () async {
                final picked = await showDatePicker(context: context, initialDate: start, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                if (picked != null) setSheetState(() => start = picked);
              },
            ),
            _DateButton(
              label: 'End: ${DateFormat('dd MMM yyyy').format(end)}',
              onTap: () async {
                final picked = await showDatePicker(context: context, initialDate: end, firstDate: start, lastDate: DateTime.now().add(const Duration(days: 365)));
                if (picked != null) setSheetState(() => end = picked);
              },
            ),
            _FieldLabel('Reason'),
            TextField(controller: reason, minLines: 2, maxLines: 3, decoration: _inputDecoration('Reason for leave')),
            _PrimaryButton(
              label: 'Submit leave',
              icon: Icons.send_outlined,
              onPressed: () async {
                try {
                  await ApiService.postJson('/leave', {
                    'employeeId': employeeId,
                    'leaveType': leaveType,
                    'startDate': _dateInput(start),
                    'endDate': _dateInput(end),
                    'reason': reason.text.trim(),
                  });
                  if (context.mounted) Navigator.pop(context, true);
                } catch (e) {
                  _toast(e.toString(), error: true);
                }
              },
            ),
          ],
        ),
      ),
    );
    if (saved == true) {
      _toast('Leave request submitted.');
      _load();
    }
  }

  Future<void> _openRegularizationDialog() async {
    final employeeId = _employeeId;
    if (employeeId == null) {
      _toast('Employee profile is not linked to this login.', error: true);
      return;
    }
    DateTime date = DateTime.now();
    final timeIn = TextEditingController(text: '09:30');
    final timeOut = TextEditingController(text: '18:30');
    final reason = TextEditingController();

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _panel,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => _SheetForm(
          title: 'Regularize attendance',
          children: [
            _DateButton(
              label: 'Date: ${DateFormat('dd MMM yyyy').format(date)}',
              onTap: () async {
                final picked = await showDatePicker(context: context, initialDate: date, firstDate: DateTime.now().subtract(const Duration(days: 30)), lastDate: DateTime.now());
                if (picked != null) setSheetState(() => date = picked);
              },
            ),
            _FieldLabel('Check-in time'),
            TextField(controller: timeIn, decoration: _inputDecoration('09:30')),
            const SizedBox(height: 12),
            _FieldLabel('Check-out time'),
            TextField(controller: timeOut, decoration: _inputDecoration('18:30')),
            const SizedBox(height: 12),
            _FieldLabel('Reason'),
            TextField(controller: reason, minLines: 2, maxLines: 3, decoration: _inputDecoration('Why is correction needed?')),
            _PrimaryButton(
              label: 'Submit correction',
              icon: Icons.fact_check_outlined,
              onPressed: () async {
                try {
                  await ApiService.postJson('/regularizations', {
                    'employeeId': employeeId,
                    'date': _dateInput(date),
                    'requestedCheckIn': '${_dateInput(date)}T${timeIn.text}:00',
                    'requestedCheckOut': '${_dateInput(date)}T${timeOut.text}:00',
                    'reason': reason.text.trim(),
                  });
                  if (context.mounted) Navigator.pop(context, true);
                } catch (e) {
                  _toast(e.toString(), error: true);
                }
              },
            ),
          ],
        ),
      ),
    );
    if (saved == true) {
      _toast('Regularization request submitted.');
      _load();
    }
  }

  void _toast(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? _rose : _teal));
  }

  @override
  Widget build(BuildContext context) {
    return _ScreenFrame(
      onRefresh: _load,
      loading: _loading,
      title: 'Leave',
      subtitle: 'Balances, requests, and attendance corrections',
      message: _message,
      children: [
        Row(
          children: [
            Expanded(child: _PrimaryButton(label: 'Apply leave', icon: Icons.edit_calendar_outlined, onPressed: _openLeaveDialog)),
            const SizedBox(width: 10),
            Expanded(child: _SecondaryButton(label: 'Regularize', icon: Icons.fact_check_outlined, onPressed: _openRegularizationDialog)),
          ],
        ),
        _Section(title: 'Leave balances', child: _LeaveBalanceList(items: _balances)),
        _Section(title: 'My leave requests', child: _LeaveRequestList(items: _requests)),
        _Section(title: 'Attendance corrections', child: _SimpleList(items: _regularizations, empty: 'No regularization requests.', titleKey: 'status', subtitleKey: 'date')),
      ],
    );
  }
}

class EmployeeMoneyScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const EmployeeMoneyScreen({super.key, required this.authProvider});

  @override
  State<EmployeeMoneyScreen> createState() => _EmployeeMoneyScreenState();
}

class _EmployeeMoneyScreenState extends State<EmployeeMoneyScreen> {
  bool _loading = true;
  String? _message;
  List<dynamic> _payslips = [];
  List<dynamic> _claims = [];
  List<dynamic> _advances = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final results = await Future.wait([
        ApiService.getJson('/payslip/history'),
        ApiService.getJson('/expenses/claims'),
        ApiService.getJson('/expenses/advances'),
      ]);
      if (!mounted) return;
      setState(() {
        _payslips = _list(results[0]);
        _claims = _list(results[1]);
        _advances = _list(results[2]);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openExpenseDialog() async {
    final title = TextEditingController();
    final category = TextEditingController(text: 'Travel');
    final amount = TextEditingController();
    final description = TextEditingController();

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _panel,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
      builder: (context) => _SheetForm(
        title: 'Submit expense',
        children: [
          _FieldLabel('Title'),
          TextField(controller: title, decoration: _inputDecoration('Client visit taxi')),
          const SizedBox(height: 12),
          _FieldLabel('Category'),
          TextField(controller: category, decoration: _inputDecoration('Travel, Meal, Internet')),
          const SizedBox(height: 12),
          _FieldLabel('Amount'),
          TextField(controller: amount, keyboardType: TextInputType.number, decoration: _inputDecoration('Amount in INR')),
          const SizedBox(height: 12),
          _FieldLabel('Description'),
          TextField(controller: description, minLines: 2, maxLines: 3, decoration: _inputDecoration('Add details for approver')),
          _PrimaryButton(
            label: 'Submit claim',
            icon: Icons.receipt_long_outlined,
            onPressed: () async {
              try {
                await ApiService.postJson('/expenses/claims', {
                  'title': title.text.trim(),
                  'category': category.text.trim(),
                  'amount': double.tryParse(amount.text) ?? 0,
                  'description': description.text.trim(),
                  'currency': 'INR',
                });
                if (context.mounted) Navigator.pop(context, true);
              } catch (e) {
                _toast(e.toString(), error: true);
              }
            },
          ),
        ],
      ),
    );

    if (saved == true) {
      _toast('Expense claim submitted.');
      _load();
    }
  }

  void _toast(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? _rose : _teal));
  }

  @override
  Widget build(BuildContext context) {
    return _ScreenFrame(
      onRefresh: _load,
      loading: _loading,
      title: 'Money',
      subtitle: 'Payslips, expenses, and travel advances',
      message: _message,
      children: [
        _Section(
          title: 'Latest payslips',
          child: _PayslipList(items: _payslips),
        ),
        _Section(
          title: 'Expense claims',
          action: TextButton.icon(onPressed: _openExpenseDialog, icon: const Icon(Icons.add, size: 18), label: const Text('Claim')),
          child: _ExpenseList(items: _claims),
        ),
        _Section(
          title: 'Travel advances',
          child: _ExpenseList(items: _advances, empty: 'No travel advances yet.'),
        ),
      ],
    );
  }
}

class EmployeeMoreScreen extends StatefulWidget {
  final AuthProvider authProvider;

  const EmployeeMoreScreen({super.key, required this.authProvider});

  @override
  State<EmployeeMoreScreen> createState() => _EmployeeMoreScreenState();
}

class _EmployeeMoreScreenState extends State<EmployeeMoreScreen> {
  bool _loading = true;
  String? _message;
  Map<String, dynamic> _profile = {};
  List<dynamic> _assets = [];
  List<dynamic> _courses = [];
  List<dynamic> _tickets = [];
  List<dynamic> _notifications = [];
  List<dynamic> _documents = [];
  List<dynamic> _approvals = [];

  String? get _employeeId => widget.authProvider.employeeId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final employeeId = _employeeId;
      final isManager = ['MANAGER', 'ADMIN', 'SUPER_ADMIN', 'HR'].contains(widget.authProvider.role);
      final results = await Future.wait([
        ApiService.getJson('/auth/profile'),
        if (employeeId != null) ApiService.getJson('/assets?assignedToId=$employeeId') else Future.value([]),
        if (employeeId != null) ApiService.getJson('/learning/enrollments?employeeId=$employeeId') else Future.value([]),
        if (employeeId != null) ApiService.getJson('/helpdesk/tickets?employeeId=$employeeId') else Future.value([]),
        ApiService.getJson('/notifications'),
        if (employeeId != null) ApiService.getJson('/documents/$employeeId') else Future.value([]),
        if (isManager) ApiService.getJson('/platform/approvals/inbox?status=PENDING') else Future.value([]),
      ]);
      if (!mounted) return;
      setState(() {
        _profile = _map(results[0]);
        _assets = _list(results[1]);
        _courses = _list(results[2]);
        _tickets = _list(results[3]);
        _notifications = _list(results[4]);
        _documents = _list(results[5]);
        _approvals = _list(results[6]);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _openTicketDialog() async {
    final subject = TextEditingController();
    final description = TextEditingController();
    String priority = 'MEDIUM';
    String category = 'HR';

    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _panel,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(8))),
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) => _SheetForm(
          title: 'Raise helpdesk ticket',
          children: [
            _FieldLabel('Category'),
            DropdownButtonFormField<String>(
              value: category,
              dropdownColor: _panel,
              decoration: _inputDecoration('Category'),
              items: const ['HR', 'IT', 'PAYROLL', 'ADMIN']
                  .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                  .toList(),
              onChanged: (value) => setSheetState(() => category = value ?? category),
            ),
            const SizedBox(height: 12),
            _FieldLabel('Priority'),
            DropdownButtonFormField<String>(
              value: priority,
              dropdownColor: _panel,
              decoration: _inputDecoration('Priority'),
              items: const ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
                  .map((item) => DropdownMenuItem(value: item, child: Text(item)))
                  .toList(),
              onChanged: (value) => setSheetState(() => priority = value ?? priority),
            ),
            const SizedBox(height: 12),
            _FieldLabel('Subject'),
            TextField(controller: subject, decoration: _inputDecoration('Issue summary')),
            const SizedBox(height: 12),
            _FieldLabel('Description'),
            TextField(controller: description, minLines: 3, maxLines: 4, decoration: _inputDecoration('Explain what support you need')),
            _PrimaryButton(
              label: 'Create ticket',
              icon: Icons.support_agent_outlined,
              onPressed: () async {
                try {
                  await ApiService.postJson('/helpdesk/tickets', {
                    'employeeId': _employeeId,
                    'category': category,
                    'subject': subject.text.trim(),
                    'description': description.text.trim(),
                    'priority': priority,
                  });
                  if (context.mounted) Navigator.pop(context, true);
                } catch (e) {
                  _toast(e.toString(), error: true);
                }
              },
            ),
          ],
        ),
      ),
    );

    if (saved == true) {
      _toast('Helpdesk ticket created.');
      _load();
    }
  }

  Future<void> _markNotificationRead(dynamic item) async {
    final id = _map(item)['id']?.toString();
    if (id == null) return;
    try {
      await ApiService.putJson('/notifications/$id/read', {});
      _toast('Notification marked as read.');
      _load();
    } catch (e) {
      _toast(e.toString(), error: true);
    }
  }

  void _toast(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text), backgroundColor: error ? _rose : _teal));
  }

  @override
  Widget build(BuildContext context) {
    final user = _map(_profile['user']);
    return _ScreenFrame(
      onRefresh: _load,
      loading: _loading,
      title: 'More',
      subtitle: 'Profile, assets, learning, helpdesk, and notifications',
      message: _message,
      children: [
        _ProfilePanel(user: user.isNotEmpty ? user : Map<String, dynamic>.from(widget.authProvider.user ?? const {})),
        if (_approvals.isNotEmpty) _Section(title: 'Pending approvals', child: _SimpleList(items: _approvals, empty: '', titleKey: 'module', subtitleKey: 'status')),
        _Section(title: 'My assets', child: _SimpleList(items: _assets, empty: 'No assets assigned.', titleKey: 'name', subtitleKey: 'assetTag')),
        _Section(title: 'Learning', child: _SimpleList(items: _courses, empty: 'No learning courses assigned.', titleKey: 'status', subtitleKey: 'dueDate')),
        _Section(
          title: 'Helpdesk',
          action: TextButton.icon(onPressed: _openTicketDialog, icon: const Icon(Icons.add, size: 18), label: const Text('Ticket')),
          child: _SimpleList(items: _tickets, empty: 'No helpdesk tickets.', titleKey: 'subject', subtitleKey: 'status'),
        ),
        _Section(title: 'Documents', child: _SimpleList(items: _documents, empty: 'No documents uploaded.', titleKey: 'documentType', subtitleKey: 'fileName')),
        _Section(title: 'Notifications', child: _NotificationList(items: _notifications, onTap: _markNotificationRead)),
      ],
    );
  }
}

class _ScreenFrame extends StatelessWidget {
  final String title;
  final String subtitle;
  final List<Widget> children;
  final Future<void> Function() onRefresh;
  final bool loading;
  final String? message;

  const _ScreenFrame({
    required this.title,
    required this.subtitle,
    required this.children,
    required this.onRefresh,
    required this.loading,
    this.message,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      body: RefreshIndicator(
        onRefresh: onRefresh,
        color: _teal,
        backgroundColor: _panel,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: const TextStyle(color: _text, fontSize: 26, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text(subtitle, style: const TextStyle(color: _muted, fontSize: 13)),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: onRefresh,
                  icon: const Icon(Icons.refresh_rounded, color: _muted),
                  tooltip: 'Refresh',
                ),
              ],
            ),
            const SizedBox(height: 18),
            if (message != null) _InlineMessage(message!),
            if (loading)
              const Padding(
                padding: EdgeInsets.only(top: 80),
                child: Center(child: CircularProgressIndicator(color: _teal)),
              )
            else
              ...children,
          ],
        ),
      ),
    );
  }
}

class _HeroPanel extends StatelessWidget {
  final String name;
  final String title;
  final String status;
  final int unread;

  const _HeroPanel({required this.name, required this.title, required this.status, required this.unread});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _panel,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _line),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: _teal.withOpacity(0.16),
            child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'E', style: const TextStyle(color: _teal, fontWeight: FontWeight.w900, fontSize: 22)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _text, fontSize: 18, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 13)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _Pill(label: status.replaceAll('_', ' '), color: _teal),
                    _Pill(label: '$unread unread', color: _amber),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  final List<Widget> children;

  const _MetricGrid({required this.children});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 1.36,
        children: children,
      ),
    );
  }
}

class _InsightMetric extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color accent;
  final String insight;

  const _InsightMetric({required this.icon, required this.label, required this.value, required this.accent, required this.insight});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: () => showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: _panel,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          title: Text(label, style: const TextStyle(color: _text, fontWeight: FontWeight.w800)),
          content: Text(insight, style: const TextStyle(color: _muted)),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Got it')),
          ],
        ),
      ),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _panel,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: _line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: accent, size: 22),
            const Spacer(),
            Text(value, style: const TextStyle(color: _text, fontSize: 24, fontWeight: FontWeight.w900)),
            const SizedBox(height: 2),
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final Widget child;
  final Widget? action;

  const _Section({required this.title, required this.child, this.action});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: const TextStyle(color: _text, fontSize: 16, fontWeight: FontWeight.w800))),
              if (action != null) action!,
            ],
          ),
          const SizedBox(height: 10),
          child,
        ],
      ),
    );
  }
}

class _QuickActions extends StatelessWidget {
  final List<_ActionItem> actions;

  const _QuickActions({required this.actions});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      childAspectRatio: 1.65,
      children: actions.map((action) => _ActionCard(action: action)).toList(),
    );
  }
}

class _ActionItem {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;

  _ActionItem(this.icon, this.title, this.subtitle, this.color);
}

class _ActionCard extends StatelessWidget {
  final _ActionItem action;

  const _ActionCard({required this.action});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(8), border: Border.all(color: _line)),
      child: Row(
        children: [
          Icon(action.icon, color: action.color),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(action.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _text, fontWeight: FontWeight.w700)),
                const SizedBox(height: 3),
                Text(action.subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  final String label;
  final Color color;

  const _Pill({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(999), border: Border.all(color: color.withOpacity(0.35))),
      child: Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

class _InlineMessage extends StatelessWidget {
  final String message;

  const _InlineMessage(this.message);

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: _rose.withOpacity(0.08), borderRadius: BorderRadius.circular(8), border: Border.all(color: _rose.withOpacity(0.35))),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: _rose, size: 18),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: const TextStyle(color: _text, fontSize: 13))),
        ],
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  const _PrimaryButton({required this.label, required this.icon, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      style: FilledButton.styleFrom(backgroundColor: _teal, foregroundColor: const Color(0xFF042F2E), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}

class _SecondaryButton extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onPressed;

  const _SecondaryButton({required this.label, required this.icon, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(foregroundColor: _text, side: const BorderSide(color: _line), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
    );
  }
}

class _SheetForm extends StatelessWidget {
  final String title;
  final List<Widget> children;

  const _SheetForm({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.only(left: 18, right: 18, top: 18, bottom: MediaQuery.of(context).viewInsets.bottom + 18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(child: Text(title, style: const TextStyle(color: _text, fontSize: 18, fontWeight: FontWeight.w800))),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, color: _muted)),
              ],
            ),
            const SizedBox(height: 12),
            ...children,
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String label;

  const _FieldLabel(this.label);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(label, style: const TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w700)),
    );
  }
}

class _DateButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _DateButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: const Icon(Icons.calendar_month_outlined, size: 18),
        label: Text(label),
        style: OutlinedButton.styleFrom(foregroundColor: _text, side: const BorderSide(color: _line), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8))),
      ),
    );
  }
}

InputDecoration _inputDecoration(String hint) {
  return InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(color: _muted),
    filled: true,
    fillColor: _panelSoft,
    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: _line)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: _line)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: _teal)),
  );
}

class _Empty extends StatelessWidget {
  final String text;

  const _Empty(this.text);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(8), border: Border.all(color: _line)),
      child: Text(text, style: const TextStyle(color: _muted)),
    );
  }
}

class _ProjectList extends StatelessWidget {
  final List<dynamic> projects;

  const _ProjectList({required this.projects});

  @override
  Widget build(BuildContext context) {
    if (projects.isEmpty) return const _Empty('No assigned projects yet.');
    return Column(children: projects.map((item) {
      final project = _map(item);
      return _ListCard(
        icon: Icons.folder_copy_outlined,
        color: _indigo,
        title: project['name']?.toString() ?? 'Project',
        subtitle: '${project['status'] ?? 'ACTIVE'} - ${_num(project['progress']).toStringAsFixed(0)}% progress',
        trailing: '${project['openTasks'] ?? 0} open',
      );
    }).toList());
  }
}

class _AvailabilityList extends StatelessWidget {
  final List<dynamic> people;

  const _AvailabilityList({required this.people});

  @override
  Widget build(BuildContext context) {
    if (people.isEmpty) return const _Empty('Team availability will appear here.');
    return Column(children: people.map((item) {
      final person = _map(item);
      final status = person['status']?.toString() ?? 'UNKNOWN';
      return _ListCard(
        icon: Icons.person_pin_circle_outlined,
        color: status == 'AVAILABLE' ? _teal : _amber,
        title: person['name']?.toString() ?? 'Team member',
        subtitle: person['role']?.toString() ?? person['department']?.toString() ?? '',
        trailing: status.replaceAll('_', ' '),
      );
    }).toList());
  }
}

class _BirthdayList extends StatelessWidget {
  final List<dynamic> items;

  const _BirthdayList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const _Empty('No birthdays in the next 30 days.');
    return Column(children: items.map((item) {
      final birthday = _map(item);
      return _ListCard(
        icon: Icons.cake_outlined,
        color: _rose,
        title: birthday['name']?.toString() ?? 'Colleague',
        subtitle: birthday['department']?.toString() ?? '',
        trailing: birthday['dayLabel']?.toString() ?? _date(birthday['date']),
      );
    }).toList());
  }
}

class _AttendanceList extends StatelessWidget {
  final List<dynamic> items;

  const _AttendanceList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const _Empty('No attendance has been marked today.');
    return Column(children: items.take(5).map((item) {
      final att = _map(item);
      final employee = _map(att['employee']);
      return _ListCard(
        icon: Icons.alarm_on_outlined,
        color: att['status'] == 'LATE' ? _amber : _teal,
        title: employee['firstName'] != null ? '${employee['firstName']} ${employee['lastName'] ?? ''}' : 'Attendance',
        subtitle: 'Status: ${att['status'] ?? '-'}',
        trailing: '${_num(att['workHours']).toStringAsFixed(1)}h',
      );
    }).toList());
  }
}

class _TaskList extends StatelessWidget {
  final List<dynamic> items;

  const _TaskList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const _Empty('No assigned tasks.');
    return Column(children: items.take(8).map((item) {
      final task = _map(item);
      final project = _map(task['project']);
      return _ListCard(
        icon: Icons.task_alt_outlined,
        color: task['status'] == 'COMPLETED' ? _teal : _indigo,
        title: task['title']?.toString() ?? 'Task',
        subtitle: project['name']?.toString() ?? task['status']?.toString() ?? '',
        trailing: task['priority']?.toString() ?? _date(task['deadline']),
      );
    }).toList());
  }
}

class _TimesheetList extends StatelessWidget {
  final List<dynamic> items;

  const _TimesheetList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const _Empty('No timesheets logged yet.');
    return Column(children: items.take(8).map((item) {
      final sheet = _map(item);
      final task = _map(sheet['task']);
      return _ListCard(
        icon: Icons.more_time_outlined,
        color: _teal,
        title: task['title']?.toString() ?? 'General work',
        subtitle: _date(sheet['date']),
        trailing: '${_num(sheet['hoursWorked']).toStringAsFixed(1)}h',
      );
    }).toList());
  }
}

class _LeaveBalanceList extends StatelessWidget {
  final List<dynamic> items;

  const _LeaveBalanceList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const _Empty('Leave balances are not available yet.');
    return Column(children: items.map((item) {
      final balance = _map(item);
      final total = _num(balance['quota']);
      final used = _num(balance['used']);
      return _ListCard(
        icon: Icons.event_available_outlined,
        color: _amber,
        title: balance['leaveType']?.toString() ?? 'Leave',
        subtitle: 'Used ${used.toStringAsFixed(0)} of ${total.toStringAsFixed(0)}',
        trailing: '${(total - used).clamp(0, 999).toStringAsFixed(0)} left',
      );
    }).toList());
  }
}

class _LeaveRequestList extends StatelessWidget {
  final List<dynamic> items;

  const _LeaveRequestList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const _Empty('No leave requests yet.');
    return Column(children: items.take(10).map((item) {
      final leave = _map(item);
      return _ListCard(
        icon: Icons.beach_access_outlined,
        color: leave['status'] == 'APPROVED' ? _teal : _amber,
        title: leave['leaveType']?.toString() ?? 'Leave',
        subtitle: '${_date(leave['startDate'])} - ${_date(leave['endDate'])}',
        trailing: leave['status']?.toString() ?? 'PENDING',
      );
    }).toList());
  }
}

class _PayslipList extends StatelessWidget {
  final List<dynamic> items;

  const _PayslipList({required this.items});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const _Empty('No payslips generated yet.');
    return Column(children: items.take(8).map((item) {
      final payslip = _map(item);
      final run = _map(payslip['payrollRun']);
      return _ListCard(
        icon: Icons.payments_outlined,
        color: _teal,
        title: 'Payslip ${run['month'] ?? payslip['month'] ?? ''}/${run['year'] ?? payslip['year'] ?? ''}',
        subtitle: 'Net pay',
        trailing: _money(payslip['netSalary']),
      );
    }).toList());
  }
}

class _ExpenseList extends StatelessWidget {
  final List<dynamic> items;
  final String empty;

  const _ExpenseList({required this.items, this.empty = 'No expense claims yet.'});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return _Empty(empty);
    return Column(children: items.take(10).map((item) {
      final claim = _map(item);
      return _ListCard(
        icon: Icons.receipt_long_outlined,
        color: claim['status'] == 'PAID' ? _teal : _amber,
        title: claim['title']?.toString() ?? claim['purpose']?.toString() ?? 'Expense',
        subtitle: claim['status']?.toString() ?? 'PENDING',
        trailing: _money(claim['amount'] ?? claim['amountRequested']),
      );
    }).toList());
  }
}

class _NotificationList extends StatelessWidget {
  final List<dynamic> items;
  final void Function(dynamic item) onTap;

  const _NotificationList({required this.items, required this.onTap});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const _Empty('No notifications.');
    return Column(children: items.take(10).map((item) {
      final notification = _map(item);
      return InkWell(
        onTap: () => onTap(item),
        child: _ListCard(
          icon: notification['readAt'] == null ? Icons.notifications_active_outlined : Icons.notifications_none_outlined,
          color: notification['readAt'] == null ? _amber : _muted,
          title: notification['title']?.toString() ?? 'Notification',
          subtitle: notification['message']?.toString() ?? '',
          trailing: notification['readAt'] == null ? 'Unread' : 'Read',
        ),
      );
    }).toList());
  }
}

class _SimpleList extends StatelessWidget {
  final List<dynamic> items;
  final String empty;
  final String titleKey;
  final String subtitleKey;

  const _SimpleList({required this.items, required this.empty, required this.titleKey, required this.subtitleKey});

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return _Empty(empty);
    return Column(children: items.take(10).map((item) {
      final value = _map(item);
      return _ListCard(
        icon: Icons.circle_outlined,
        color: _indigo,
        title: value[titleKey]?.toString() ?? 'Record',
        subtitle: value[subtitleKey]?.toString() ?? '',
        trailing: _date(value['createdAt'] ?? value['date']),
      );
    }).toList());
  }
}

class _ListCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final String trailing;

  const _ListCard({required this.icon, required this.color, required this.title, required this.subtitle, required this.trailing});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(8), border: Border.all(color: _line)),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(8)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _text, fontWeight: FontWeight.w700)),
                const SizedBox(height: 3),
                Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(trailing, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _ProfilePanel extends StatelessWidget {
  final Map<String, dynamic> user;

  const _ProfilePanel({required this.user});

  @override
  Widget build(BuildContext context) {
    final name = user['name']?.toString() ?? 'Employee';
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(8), border: Border.all(color: _line)),
      child: Row(
        children: [
          CircleAvatar(
            radius: 25,
            backgroundColor: _indigo.withOpacity(0.16),
            child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'E', style: const TextStyle(color: _indigo, fontSize: 20, fontWeight: FontWeight.w900)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _text, fontSize: 17, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text(user['email']?.toString() ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: _muted, fontSize: 12)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, children: [
                  _Pill(label: user['role']?.toString() ?? 'EMPLOYEE', color: _teal),
                  if (user['companyName'] != null) _Pill(label: user['companyName'].toString(), color: _amber),
                ]),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
