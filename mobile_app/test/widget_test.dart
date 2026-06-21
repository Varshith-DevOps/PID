// Basic smoke test for the PID hcms mobile app.

import 'package:flutter_test/flutter_test.dart';

import 'package:pid_hcms_mobile/main.dart';

void main() {
  testWidgets('App boots to the login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const PIDHcmsApp());
    await tester.pump();

    // An unauthenticated launch should land on the login screen.
    expect(find.text('Secure Login'), findsOneWidget);
  });
}
