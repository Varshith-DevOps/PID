import 'package:flutter/material.dart';
import '../services/api_service.dart';

const _bg = Color(0xFF0B1020);
const _panel = Color(0xFF111827);
const _panelSoft = Color(0xFF172033);
const _line = Color(0xFF263247);
const _text = Color(0xFFE5E7EB);
const _muted = Color(0xFF94A3B8);
const _teal = Color(0xFF2DD4BF);

/// Board columns in the order the backend uses for the Jira-style board.
const _statuses = <String, String>{
  'TODO': 'To do',
  'IN_PROGRESS': 'In progress',
  'AWAITING_APPROVAL': 'Awaiting approval',
  'REWORK': 'Rework',
  'COMPLETED': 'Completed',
};

const _statusColors = <String, Color>{
  'TODO': Color(0xFF94A3B8),
  'IN_PROGRESS': Color(0xFF818CF8),
  'AWAITING_APPROVAL': Color(0xFFF59E0B),
  'REWORK': Color(0xFFFB7185),
  'COMPLETED': Color(0xFF2DD4BF),
};

Map<String, dynamic> _map(dynamic v) => v is Map ? Map<String, dynamic>.from(v) : {};
List<dynamic> _list(dynamic v) {
  if (v is List) return v;
  if (v is Map && v['projects'] is List) return v['projects'];
  if (v is Map && v['data'] is List) return v['data'];
  return [];
}

class ProjectBoardScreen extends StatefulWidget {
  const ProjectBoardScreen({super.key});

  @override
  State<ProjectBoardScreen> createState() => _ProjectBoardScreenState();
}

class _ProjectBoardScreenState extends State<ProjectBoardScreen> {
  bool _loading = true;
  String? _message;
  List<dynamic> _projects = [];
  String? _projectId;
  Map<String, dynamic> _board = {};

  @override
  void initState() {
    super.initState();
    _loadProjects();
  }

  Future<void> _loadProjects() async {
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final data = await ApiService.getJson('/projects?limit=50');
      final projects = _list(data);
      if (!mounted) return;
      setState(() {
        _projects = projects;
        _projectId = projects.isNotEmpty ? _map(projects.first)['id']?.toString() : null;
      });
      if (_projectId != null) {
        await _loadBoard();
      } else {
        setState(() => _loading = false);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _message = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadBoard() async {
    final id = _projectId;
    if (id == null) return;
    setState(() {
      _loading = true;
      _message = null;
    });
    try {
      final data = await ApiService.getJson('/projects/$id/board');
      if (!mounted) return;
      setState(() {
        _board = _map(data);
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

  List<dynamic> _columnTasks(String status) {
    final columns = _board['columns'];
    if (columns is List) {
      for (final col in columns) {
        if (_map(col)['status']?.toString() == status) return _list(_map(col)['tasks']);
      }
    }
    return [];
  }

  Future<void> _moveTask(Map<String, dynamic> task) async {
    final id = task['id']?.toString();
    if (id == null) return;
    final current = task['status']?.toString() ?? 'TODO';

    final newStatus = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: _panel,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(14))),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
              child: Row(
                children: [
                  Expanded(
                    child: Text(task['title']?.toString() ?? 'Task',
                        style: const TextStyle(color: _text, fontWeight: FontWeight.w800, fontSize: 16)),
                  ),
                ],
              ),
            ),
            const Divider(color: _line, height: 1),
            ..._statuses.entries.map((e) => ListTile(
                  leading: Icon(Icons.circle, size: 12, color: _statusColors[e.key]),
                  title: Text(e.value, style: const TextStyle(color: _text)),
                  trailing: e.key == current ? const Icon(Icons.check, color: _teal, size: 18) : null,
                  onTap: () => Navigator.pop(context, e.key),
                )),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );

    if (newStatus == null || newStatus == current) return;
    try {
      await ApiService.putJson('/projects/tasks/$id/move', {'status': newStatus, 'boardRank': 0});
      _toast('Task moved to ${_statuses[newStatus]}.');
      _loadBoard();
    } catch (e) {
      _toast(e.toString(), error: true);
    }
  }

  void _toast(String text, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(text), backgroundColor: error ? const Color(0xFFFB7185) : _teal),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(
        backgroundColor: _bg,
        elevation: 0,
        title: const Text('Project Board', style: TextStyle(color: _text, fontWeight: FontWeight.w800)),
        iconTheme: const IconThemeData(color: _muted),
        actions: [
          IconButton(onPressed: _loadBoard, icon: const Icon(Icons.refresh_rounded, color: _muted)),
        ],
      ),
      body: Column(
        children: [
          if (_projects.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
              child: DropdownButtonFormField<String>(
                value: _projectId,
                dropdownColor: _panel,
                isExpanded: true,
                style: const TextStyle(color: _text),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: _panelSoft,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: _line)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: _line)),
                ),
                items: _projects.map((p) {
                  final project = _map(p);
                  return DropdownMenuItem<String>(
                    value: project['id']?.toString(),
                    child: Text(project['name']?.toString() ?? 'Project', overflow: TextOverflow.ellipsis),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() => _projectId = value);
                  _loadBoard();
                },
              ),
            ),
          if (_message != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_message!, style: const TextStyle(color: Color(0xFFFB7185))),
            ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: _teal))
                : _projects.isEmpty
                    ? const Center(child: Text('No projects assigned.', style: TextStyle(color: _muted)))
                    : ListView(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.fromLTRB(12, 6, 12, 16),
                        children: _statuses.keys.map((status) => _BoardColumn(
                              status: status,
                              title: _statuses[status]!,
                              color: _statusColors[status]!,
                              tasks: _columnTasks(status),
                              onTapTask: _moveTask,
                            )).toList(),
                      ),
          ),
        ],
      ),
    );
  }
}

class _BoardColumn extends StatelessWidget {
  final String status;
  final String title;
  final Color color;
  final List<dynamic> tasks;
  final void Function(Map<String, dynamic> task) onTapTask;

  const _BoardColumn({
    required this.status,
    required this.title,
    required this.color,
    required this.tasks,
    required this.onTapTask,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 270,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(12), border: Border.all(color: _line)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
            child: Row(
              children: [
                Icon(Icons.circle, size: 10, color: color),
                const SizedBox(width: 8),
                Text(title, style: const TextStyle(color: _text, fontWeight: FontWeight.w800)),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(color: color.withOpacity(0.14), borderRadius: BorderRadius.circular(999)),
                  child: Text('${tasks.length}', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
          const Divider(color: _line, height: 1),
          Expanded(
            child: tasks.isEmpty
                ? const Center(child: Text('No tasks', style: TextStyle(color: _muted, fontSize: 12)))
                : ListView.builder(
                    padding: const EdgeInsets.all(10),
                    itemCount: tasks.length,
                    itemBuilder: (context, i) => _TaskCard(task: _map(tasks[i]), accent: color, onTap: onTapTask),
                  ),
          ),
        ],
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  final Map<String, dynamic> task;
  final Color accent;
  final void Function(Map<String, dynamic> task) onTap;

  const _TaskCard({required this.task, required this.accent, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final assignee = _map(task['assignee']);
    final assigneeName = assignee.isNotEmpty
        ? '${assignee['firstName'] ?? ''} ${assignee['lastName'] ?? ''}'.trim()
        : '';
    final priority = task['priority']?.toString();
    return InkWell(
      onTap: () => onTap(task),
      borderRadius: BorderRadius.circular(10),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: _panelSoft, borderRadius: BorderRadius.circular(10), border: Border.all(color: _line)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(task['title']?.toString() ?? 'Task',
                maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: _text, fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: 8),
            Row(
              children: [
                if (priority != null && priority.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(color: accent.withOpacity(0.14), borderRadius: BorderRadius.circular(6)),
                    child: Text(priority, style: TextStyle(color: accent, fontSize: 10, fontWeight: FontWeight.w700)),
                  ),
                const Spacer(),
                if (assigneeName.isNotEmpty)
                  Text(assigneeName, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: _muted, fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
