const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const MODULES = ['USERS', 'EMPLOYEES', 'ATTENDANCE', 'LEAVE', 'PAYROLL', 'REPORTS', 'SETTINGS'];
const ACTIONS = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT'];
const getPermissions = (role) => {
  const defaults = {
    SUPER_ADMIN: MODULES.flatMap((m) => ACTIONS.map((a) => ({ module: m, action: a, isGranted: true }))),
    ADMIN: MODULES.flatMap((m) => [
      { module: m, action: 'VIEW', isGranted: true },{ module: m, action: 'CREATE', isGranted: true },
      { module: m, action: 'EDIT', isGranted: true },{ module: m, action: 'DELETE', isGranted: false },
      { module: m, action: 'EXPORT', isGranted: true },
    ]),
    MANAGER: [
      { module: 'EMPLOYEES', action: 'VIEW', isGranted: true },{ module: 'EMPLOYEES', action: 'CREATE', isGranted: true },
      { module: 'EMPLOYEES', action: 'EDIT', isGranted: true },{ module: 'ATTENDANCE', action: 'VIEW', isGranted: true },
      { module: 'ATTENDANCE', action: 'CREATE', isGranted: true },{ module: 'ATTENDANCE', action: 'EDIT', isGranted: true },
      { module: 'LEAVE', action: 'VIEW', isGranted: true },{ module: 'LEAVE', action: 'CREATE', isGranted: true },
      { module: 'LEAVE', action: 'EDIT', isGranted: true },{ module: 'REPORTS', action: 'VIEW', isGranted: true },
      { module: 'REPORTS', action: 'EXPORT', isGranted: true },{ module: 'PAYROLL', action: 'VIEW', isGranted: true },
    ],
    EMPLOYEE: [
      { module: 'ATTENDANCE', action: 'VIEW', isGranted: true },{ module: 'ATTENDANCE', action: 'CREATE', isGranted: true },
      { module: 'LEAVE', action: 'VIEW', isGranted: true },{ module: 'LEAVE', action: 'CREATE', isGranted: true },
      { module: 'REPORTS', action: 'VIEW', isGranted: true },
    ],
  };
  return defaults[role] || [];
};

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function getWorkingDays(year, month) {
  const days = [];
  const dim = new Date(year, month, 0).getDate();
  for (let d = 1; d <= dim; d++) { const dt = new Date(year, month - 1, d); if (dt.getDay() !== 0 && dt.getDay() !== 6) days.push(dt); }
  return days;
}

const EMPLOYEE_DATA = [
  { first:'Rajesh',last:'Kumar',email:'rajesh.kumar@company.com',title:'Engineering Lead',dept:'Engineering',salary:120000 },
  { first:'Priya',last:'Sharma',email:'priya.sharma@company.com',title:'Senior Developer',dept:'Engineering',salary:95000 },
  { first:'Amit',last:'Patel',email:'amit.patel@company.com',title:'Full Stack Developer',dept:'Engineering',salary:85000 },
  { first:'Sneha',last:'Reddy',email:'sneha.reddy@company.com',title:'Frontend Developer',dept:'Engineering',salary:80000 },
  { first:'Vikram',last:'Singh',email:'vikram.singh@company.com',title:'Backend Developer',dept:'Engineering',salary:82000 },
  { first:'Ananya',last:'Gupta',email:'ananya.gupta@company.com',title:'QA Engineer',dept:'Engineering',salary:72000 },
  { first:'Karthik',last:'Nair',email:'karthik.nair@company.com',title:'DevOps Engineer',dept:'Engineering',salary:90000 },
  { first:'Deepa',last:'Iyer',email:'deepa.iyer@company.com',title:'Junior Developer',dept:'Engineering',salary:55000 },
  { first:'Meera',last:'Joshi',email:'meera.joshi@company.com',title:'HR Manager',dept:'Human Resources',salary:95000 },
  { first:'Suresh',last:'Menon',email:'suresh.menon@company.com',title:'HR Executive',dept:'Human Resources',salary:55000 },
  { first:'Kavita',last:'Desai',email:'kavita.desai@company.com',title:'Recruitment Specialist',dept:'Human Resources',salary:60000 },
  { first:'Arun',last:'Krishnan',email:'arun.krishnan@company.com',title:'Finance Lead',dept:'Finance',salary:105000 },
  { first:'Lakshmi',last:'Rajan',email:'lakshmi.rajan@company.com',title:'Senior Accountant',dept:'Finance',salary:70000 },
  { first:'Rahul',last:'Verma',email:'rahul.verma@company.com',title:'Accounts Executive',dept:'Finance',salary:55000 },
  { first:'Nisha',last:'Agarwal',email:'nisha.agarwal@company.com',title:'Marketing Lead',dept:'Marketing',salary:100000 },
  { first:'Sanjay',last:'Mishra',email:'sanjay.mishra@company.com',title:'Digital Marketing Exec',dept:'Marketing',salary:65000 },
  { first:'Pooja',last:'Chauhan',email:'pooja.chauhan@company.com',title:'Content Strategist',dept:'Marketing',salary:60000 },
  { first:'Manoj',last:'Tiwari',email:'manoj.tiwari@company.com',title:'Operations Lead',dept:'Operations',salary:90000 },
  { first:'Divya',last:'Saxena',email:'divya.saxena@company.com',title:'Operations Coordinator',dept:'Operations',salary:50000 },
  { first:'Arjun',last:'Rao',email:'arjun.rao@company.com',title:'Logistics Coordinator',dept:'Operations',salary:48000 },
];

const CITIES = ['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Pune','Kolkata','Ahmedabad','Jaipur','Lucknow'];
const STATES = ['Maharashtra','Delhi','Karnataka','Telangana','Tamil Nadu','Maharashtra','West Bengal','Gujarat','Rajasthan','Uttar Pradesh'];
const DEGREES = ['B.Tech','B.E.','M.Tech','MBA','BCA','MCA','B.Sc','M.Sc','B.Com','M.Com'];
const INSTITUTIONS = ['IIT Delhi','IIT Bombay','NIT Trichy','BITS Pilani','VIT Vellore','Anna University','Delhi University','Mumbai University','Pune University','Bangalore University'];
const COMPANIES = ['TCS','Infosys','Wipro','HCL','Tech Mahindra','Cognizant','Accenture','Capgemini','L&T Infotech','Mindtree'];

async function main() {
  console.log('🌱 Starting comprehensive seed...');

  // Clear all data
  await prisma.timesheet.deleteMany();
  await prisma.overtime.deleteMany();
  await prisma.payrollRecord.deleteMany();
  await prisma.payrollRun.deleteMany();
  await prisma.salaryStructure.deleteMany();
  await prisma.salaryRevision.deleteMany();
  await prisma.leaveQuota.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.projectExpense.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectResource.deleteMany();
  await prisma.project.deleteMany();
  await prisma.document.deleteMany();
  await prisma.dependent.deleteMany();
  await prisma.exitDetails.deleteMany();
  await prisma.pFDetails.deleteMany();
  await prisma.bankDetails.deleteMany();
  await prisma.professionalExperience.deleteMany();
  await prisma.education.deleteMany();
  await prisma.employeeAddress.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.user.deleteMany();
  await prisma.attendanceSettings.deleteMany();
  await prisma.payrollSettings.deleteMany();
  console.log('✅ Cleared existing data');

  // Departments
  const deptNames = ['Engineering','Human Resources','Finance','Marketing','Operations'];
  const deptDescs = ['Software Development','HR Department','Finance & Accounting','Marketing & Sales','Operations'];
  const depts = {};
  for (let i = 0; i < deptNames.length; i++) {
    const d = await prisma.department.upsert({ where:{name:deptNames[i]}, update:{}, create:{name:deptNames[i],description:deptDescs[i]} });
    depts[deptNames[i]] = d;
  }
  console.log('✅ Departments created');

  // System users (admin accounts)
  const hashedAdmin = await bcrypt.hash('admin123', 10);
  const sysUsers = [
    { email:'superadmin@hrms.com', name:'Super Admin', role:'SUPER_ADMIN' },
    { email:'admin@hrms.com', name:'Admin User', role:'ADMIN' },
    { email:'manager@hrms.com', name:'Manager User', role:'MANAGER' },
  ];
  for (const u of sysUsers) {
    await prisma.user.create({ data:{ email:u.email, password:hashedAdmin, name:u.name, role:u.role, permissions:{ create:getPermissions(u.role) } } });
  }
  console.log('✅ System users created');

  // Settings
  await prisma.attendanceSettings.create({ data:{} });
  await prisma.payrollSettings.create({ data:{} });

  // Create User account + Employee for each of the 20 employees
  const hashedEmp = await bcrypt.hash('employee123', 10);
  const employees = [];
  for (let i = 0; i < EMPLOYEE_DATA.length; i++) {
    const ed = EMPLOYEE_DATA[i];
    // Create user account
    const user = await prisma.user.create({
      data: { email:ed.email, password:hashedEmp, name:`${ed.first} ${ed.last}`, role:'EMPLOYEE', permissions:{ create:getPermissions('EMPLOYEE') } },
    });
    const emp = await prisma.employee.create({
      data: {
        employeeId:`EMP${String(i+1).padStart(5,'0')}`, firstName:ed.first, lastName:ed.last, email:ed.email,
        phone:`+91${randInt(7000000000,9999999999)}`, gender:pick(['MALE','FEMALE']), jobTitle:ed.title,
        departmentId:depts[ed.dept].id, salary:ed.salary, userId:user.id,
        joinDate:new Date(`2024-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`),
        nationality:'Indian', bloodGroup:pick(['A+','B+','O+','AB+','A-','B-','O-']),
        maritalStatus:pick(['Single','Married','Single']),
        panNumber:`ABCPD${randInt(1000,9999)}${pick(['A','B','C','D'])}`,
        aadharNumber:`${randInt(1000,9999)} ${randInt(1000,9999)} ${randInt(1000,9999)}`,
        emergencyContactName:pick(['Ramesh','Sunita','Mohan','Priya','Sunil']),
        emergencyContactPhone:`+91${randInt(7000000000,9999999999)}`,
        emergencyContactRelation:pick(['Father','Mother','Spouse','Sibling']),
        dateOfBirth:new Date(`${randInt(1985,2000)}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`),
      },
    });
    employees.push(emp);
  }
  // Set managers
  for (let i = 1; i <= 7; i++) await prisma.employee.update({ where:{id:employees[i].id}, data:{managerId:employees[0].id} });
  console.log('✅ 20 Employees + User accounts created');

  // Addresses (2 per employee)
  for (const emp of employees) {
    const ci = randInt(0,9);
    await prisma.employeeAddress.create({ data:{ employeeId:emp.id, type:'CURRENT', line1:`${randInt(1,500)}, ${pick(['MG Road','Park Street','Brigade Road','Jubilee Hills'])}`, city:CITIES[ci], state:STATES[ci], pincode:`${randInt(100000,999999)}` } });
    const pi = randInt(0,9);
    await prisma.employeeAddress.create({ data:{ employeeId:emp.id, type:'PERMANENT', line1:`${randInt(1,200)}, ${pick(['Main Road','Station Road','Gandhi Nagar','Temple Street'])}`, city:CITIES[pi], state:STATES[pi], pincode:`${randInt(100000,999999)}` } });
  }
  console.log('✅ Addresses created');

  // Education (1-2 per employee)
  for (const emp of employees) {
    await prisma.education.create({ data:{ employeeId:emp.id, degree:pick(DEGREES), institution:pick(INSTITUTIONS), university:pick(INSTITUTIONS), yearOfPassing:randInt(2010,2023), percentage:randInt(60,95), specialization:pick(['Computer Science','IT','Electronics','Business','Finance','Marketing']) } });
    if (Math.random() > 0.4) {
      await prisma.education.create({ data:{ employeeId:emp.id, degree:pick(['M.Tech','MBA','MCA','M.Sc']), institution:pick(INSTITUTIONS), yearOfPassing:randInt(2014,2024), percentage:randInt(65,90), specialization:pick(['AI/ML','Data Science','Operations','HR','Finance']) } });
    }
  }
  console.log('✅ Education records created');

  // Experience (for senior employees - first 14)
  for (let i = 0; i < 14; i++) {
    const startYear = randInt(2015,2021);
    await prisma.professionalExperience.create({ data:{ employeeId:employees[i].id, company:pick(COMPANIES), designation:pick(['Software Engineer','Analyst','Consultant','Associate','Executive']), fromDate:new Date(`${startYear}-${String(randInt(1,12)).padStart(2,'0')}-01`), toDate:new Date(`${startYear+randInt(1,3)}-${String(randInt(1,12)).padStart(2,'0')}-28`), description:pick(['Full stack development','Backend services','Frontend UI','Data analysis','Project management']) } });
  }
  console.log('✅ Experience records created');

  // Bank Details
  const BANKS = ['State Bank of India','HDFC Bank','ICICI Bank','Axis Bank','Kotak Mahindra Bank','Punjab National Bank','Bank of Baroda','Canara Bank'];
  for (const emp of employees) {
    await prisma.bankDetails.create({ data:{ employeeId:emp.id, bankName:pick(BANKS), accountNumber:`${randInt(1000,9999)}${randInt(1000,9999)}${randInt(10,99)}`, ifscCode:`${pick(['SBIN','HDFC','ICIC','UTIB','KKBK','PUNB'])}0${randInt(100000,999999)}`, branchName:pick(['MG Road Branch','Main Branch','Electronic City Branch','Whitefield Branch','Jubilee Hills Branch']), accountType:pick(['SAVINGS','SAVINGS','SAVINGS','CURRENT']) } });
  }
  console.log('✅ Bank details created');

  // PF Details
  for (const emp of employees) {
    await prisma.pFDetails.create({ data:{ employeeId:emp.id, pfNumber:`KN/BLR/${randInt(10000,99999)}/${randInt(100,999)}`, uanNumber:`${randInt(100000000000,999999999999)}`, epsNumber:`KN/BLR/${randInt(10000,99999)}`, pfJoinDate:emp.joinDate, voluntaryPF:Math.random()>0.7, vpfPercentage:Math.random()>0.7?pick([1,2,3,5]):null } });
  }
  console.log('✅ PF details created');

  // Dependents (for married employees)
  const SPOUSE_NAMES_M = ['Priya','Sneha','Anita','Kavita','Meera','Deepa','Sunita','Lakshmi'];
  const SPOUSE_NAMES_F = ['Rahul','Amit','Suresh','Vikram','Karthik','Rajesh','Manoj','Arun'];
  const CHILD_NAMES = ['Aryan','Isha','Aditya','Anaya','Vivaan','Diya','Reyansh','Sara','Kabir','Myra'];
  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const ed = EMPLOYEE_DATA[i];
    const gender = pick(['MALE','FEMALE']);
    if (Math.random() > 0.4) { // ~60% married
      const spouseName = gender === 'MALE' ? pick(SPOUSE_NAMES_M) : pick(SPOUSE_NAMES_F);
      await prisma.dependent.create({ data:{ employeeId:emp.id, name:spouseName, relationship:'SPOUSE', dateOfBirth:new Date(`${randInt(1985,2000)}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`), gender:gender==='MALE'?'FEMALE':'MALE', isNominee:true, nomineePercent:50 } });
      if (Math.random() > 0.4) {
        await prisma.dependent.create({ data:{ employeeId:emp.id, name:pick(CHILD_NAMES), relationship:'CHILD', dateOfBirth:new Date(`${randInt(2015,2024)}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`), gender:pick(['MALE','FEMALE']), isNominee:false } });
      }
    }
    // Parent as nominee
    await prisma.dependent.create({ data:{ employeeId:emp.id, name:pick(['Ramesh','Sunita','Mohan','Priya']), relationship:'PARENT', dateOfBirth:new Date(`${randInt(1955,1970)}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`), gender:pick(['MALE','FEMALE']), isNominee:true, nomineePercent:50 } });
  }
  console.log('✅ Dependents created');

  // Update account stages for leads/managers
  for (let i of [0,8,11,14,17]) {
    await prisma.employee.update({ where:{id:employees[i].id}, data:{accountStage:'MANAGER'} });
  }
  console.log('✅ Account stages updated');

  // Salary Revisions (2 per employee)
  for (const emp of employees) {
    const initSalary = Math.round(emp.salary * 0.8);
    await prisma.salaryRevision.create({ data:{ employeeId:emp.id, effectiveDate:new Date('2025-04-01'), previousSalary:initSalary, revisedSalary:Math.round(initSalary*1.12), reason:'Annual appraisal 2025', revisedBy:'admin' } });
    await prisma.salaryRevision.create({ data:{ employeeId:emp.id, effectiveDate:new Date('2026-04-01'), previousSalary:Math.round(initSalary*1.12), revisedSalary:emp.salary, reason:'Annual appraisal 2026', revisedBy:'admin' } });
  }
  console.log('✅ Salary revisions created');

  // Projects
  const project1 = await prisma.project.create({ data:{ name:'NexusHR Mobile App', description:'Cross-platform mobile app for NexusHR', startDate:new Date('2026-02-15'), deadline:new Date('2026-07-31'), budget:2500000, status:'ACTIVE', managerId:employees[0].id } });
  const project2 = await prisma.project.create({ data:{ name:'Customer Portal Revamp', description:'Complete portal redesign', startDate:new Date('2026-03-01'), deadline:new Date('2026-08-15'), budget:1800000, status:'ACTIVE', managerId:employees[14].id } });
  console.log('✅ Projects created');

  // Project Resources
  const proj1Emps = [0,1,2,3,4,5,6,7]; const proj2Emps = [11,12,13,14,15,16,8,17];
  for (const idx of proj1Emps) await prisma.projectResource.create({ data:{ projectId:project1.id, employeeId:employees[idx].id } });
  for (const idx of proj2Emps) await prisma.projectResource.create({ data:{ projectId:project2.id, employeeId:employees[idx].id } });

  // Tasks
  const p1Tasks = [
    {title:'Design Mobile App Architecture',assignee:0,est:40,status:'COMPLETED',priority:'HIGH'},
    {title:'Setup React Native Project',assignee:1,est:16,status:'COMPLETED',priority:'HIGH'},
    {title:'Build Authentication Module',assignee:2,est:32,status:'COMPLETED',priority:'HIGH'},
    {title:'Attendance Check-in UI',assignee:3,est:24,status:'IN_PROGRESS',priority:'HIGH'},
    {title:'Leave Request Flow',assignee:4,est:24,status:'IN_PROGRESS',priority:'MEDIUM'},
    {title:'Push Notification Service',assignee:6,est:20,status:'IN_PROGRESS',priority:'MEDIUM'},
    {title:'API Integration Layer',assignee:1,est:32,status:'IN_PROGRESS',priority:'HIGH'},
    {title:'Unit & Integration Tests',assignee:5,est:40,status:'TODO',priority:'MEDIUM'},
    {title:'Performance Optimization',assignee:6,est:16,status:'TODO',priority:'LOW'},
    {title:'CI/CD Pipeline Setup',assignee:6,est:12,status:'COMPLETED',priority:'HIGH'},
    {title:'Dashboard Widgets',assignee:7,est:20,status:'IN_PROGRESS',priority:'MEDIUM'},
    {title:'Offline Data Sync',assignee:2,est:28,status:'TODO',priority:'HIGH'},
  ];
  const p2Tasks = [
    {title:'Portal UX Research',assignee:14,est:24,status:'COMPLETED',priority:'HIGH'},
    {title:'Wireframe & Prototype',assignee:15,est:32,status:'COMPLETED',priority:'HIGH'},
    {title:'Frontend Development',assignee:16,est:60,status:'IN_PROGRESS',priority:'HIGH'},
    {title:'Analytics Dashboard',assignee:11,est:40,status:'IN_PROGRESS',priority:'HIGH'},
    {title:'Payment Integration',assignee:12,est:24,status:'TODO',priority:'HIGH'},
    {title:'Customer Self-Service Module',assignee:13,est:32,status:'IN_PROGRESS',priority:'MEDIUM'},
    {title:'SEO & Performance Audit',assignee:15,est:16,status:'TODO',priority:'LOW'},
    {title:'Content Migration',assignee:16,est:20,status:'TODO',priority:'MEDIUM'},
    {title:'User Acceptance Testing',assignee:8,est:24,status:'TODO',priority:'MEDIUM'},
    {title:'Stakeholder Presentations',assignee:17,est:12,status:'IN_PROGRESS',priority:'LOW'},
  ];
  const allTasks = [];
  for (const t of p1Tasks) {
    const task = await prisma.task.create({ data:{ title:t.title, projectId:project1.id, assigneeId:employees[t.assignee].id, estimatedHours:t.est, status:t.status, priority:t.priority, deadline:new Date('2026-06-30'), completedAt:t.status==='COMPLETED'?new Date(`2026-03-${randInt(15,28)}`):null, actualHours:t.status==='COMPLETED'?t.est+randInt(-5,8):(t.status==='IN_PROGRESS'?Math.floor(t.est*0.5):0) } });
    allTasks.push({...task,assigneeIdx:t.assignee});
  }
  for (const t of p2Tasks) {
    const task = await prisma.task.create({ data:{ title:t.title, projectId:project2.id, assigneeId:employees[t.assignee].id, estimatedHours:t.est, status:t.status, priority:t.priority, deadline:new Date('2026-07-15'), completedAt:t.status==='COMPLETED'?new Date(`2026-03-${randInt(20,31)}`):null, actualHours:t.status==='COMPLETED'?t.est+randInt(-3,5):(t.status==='IN_PROGRESS'?Math.floor(t.est*0.4):0) } });
    allTasks.push({...task,assigneeIdx:t.assignee});
  }
  console.log('✅ Tasks created');

  // Attendance
  const marchDays = getWorkingDays(2026,3); const aprilDays = getWorkingDays(2026,4);
  const allWorkDays = [...marchDays,...aprilDays];
  let attCount = 0;
  for (const emp of employees) {
    for (const day of allWorkDays) {
      const rand = Math.random();
      let status, lateMin = 0;
      if (rand<0.82) status='PRESENT'; else if (rand<0.90) { status='LATE'; lateMin=randInt(5,45); } else if (rand<0.94) status='HALF_DAY'; else continue;
      const ciH = status==='LATE'?9:randInt(8,9); const ciM = status==='LATE'?randInt(15,55):randInt(0,15);
      const checkIn = new Date(day); checkIn.setHours(ciH,ciM,0,0);
      const workH = status==='HALF_DAY'?randInt(3,4):randInt(8,9);
      const checkOut = new Date(checkIn.getTime()+workH*3600000+randInt(0,30)*60000);
      await prisma.attendance.create({ data:{ employeeId:emp.id, date:new Date(day.getFullYear(),day.getMonth(),day.getDate()), checkIn, checkOut, status, lateMinutes:lateMin, workHours:Math.round(((checkOut-checkIn)/3600000)*100)/100 } });
      attCount++;
    }
  }
  console.log(`✅ ${attCount} Attendance records`);

  // Leaves
  const leaveTypes=['ANNUAL','SICK','CASUAL']; const leaveStatuses=['APPROVED','APPROVED','APPROVED','PENDING','REJECTED'];
  for (let i=0;i<18;i++) {
    const emp=employees[randInt(0,19)]; const month=pick([3,4]); const startDay=randInt(1,25); const days=randInt(1,3);
    const status=pick(leaveStatuses);
    await prisma.leave.create({ data:{ employeeId:emp.id, leaveType:pick(leaveTypes), startDate:new Date(2026,month-1,startDay), endDate:new Date(2026,month-1,startDay+days-1), days, reason:pick(['Family function','Not feeling well','Personal work','Medical appointment','Travel','Festival']), status, approvedBy:status==='APPROVED'?'admin':null, approvedAt:status==='APPROVED'?new Date():null, rejectReason:status==='REJECTED'?'Insufficient leave balance':null } });
  }

  // Leave Quotas
  for (const emp of employees) {
    await prisma.leaveQuota.create({data:{employeeId:emp.id,year:2026,leaveType:'ANNUAL',quota:20}});
    await prisma.leaveQuota.create({data:{employeeId:emp.id,year:2026,leaveType:'SICK',quota:10}});
    await prisma.leaveQuota.create({data:{employeeId:emp.id,year:2026,leaveType:'CASUAL',quota:5}});
  }

  // Salary Structures
  for (const emp of employees) {
    const basic=Math.round(emp.salary*0.5);
    await prisma.salaryStructure.create({ data:{ employeeId:emp.id, basicSalary:basic, hra:Math.round(basic*0.4), da:Math.round(basic*0.1), conveyance:1600, medical:1250, specialAllowance:Math.round(emp.salary-basic-basic*0.4-basic*0.1-2850), otherAllowance:0, pfEnabled:true, tdsEnabled:emp.salary>50000, insurance:500 } });
  }

  // Payroll Runs
  for (const month of [3,4]) {
    const run = await prisma.payrollRun.create({ data:{month,year:2026,status:'PROCESSED',processedBy:'admin',processedAt:new Date(2026,month-1,28),employeeCount:20} });
    let total=0;
    for (const emp of employees) {
      const basic=Math.round(emp.salary*0.5); const hra=Math.round(basic*0.4); const da=Math.round(basic*0.1);
      const conv=1600; const med=1250; const special=Math.max(0,Math.round(emp.salary-basic-hra-da-2850));
      const gross=basic+hra+da+conv+med+special; const pf=Math.min(Math.round(basic*0.12),2160);
      const annual=gross*12; let tds=0;
      if(annual>1500000) tds=Math.round((187500+(annual-1500000)*0.30)/12);
      else if(annual>1250000) tds=Math.round((125000+(annual-1250000)*0.25)/12);
      else if(annual>1000000) tds=Math.round((75000+(annual-1000000)*0.20)/12);
      else if(annual>750000) tds=Math.round((37500+(annual-750000)*0.15)/12);
      else if(annual>500000) tds=Math.round((12500+(annual-500000)*0.10)/12);
      else if(annual>250000) tds=Math.round(((annual-250000)*0.05)/12);
      const ins=500; const totalDed=pf+tds+ins; const net=gross-totalDed; total+=net;
      await prisma.payrollRecord.create({ data:{ payrollRunId:run.id, employeeId:emp.id, basicSalary:basic, hra, da, conveyance:conv, medical:med, specialAllowance:special, otherAllowance:0, grossEarnings:gross, pf, tax:tds, insurance:ins, otherDeductions:0, totalDeductions:totalDed, netSalary:net, workDays:22, daysWorked:randInt(19,22), leaves:randInt(0,2), deductions:0, status:'PROCESSED' } });
    }
    await prisma.payrollRun.update({where:{id:run.id},data:{totalAmount:total}});
  }
  console.log('✅ Payroll done');

  // Timesheets
  const tasksByEmployee = {};
  for (const t of allTasks) { if(!tasksByEmployee[t.assigneeIdx]) tasksByEmployee[t.assigneeIdx]=[]; tasksByEmployee[t.assigneeIdx].push(t); }
  let tsCount=0;
  for (const [idxStr,tasks] of Object.entries(tasksByEmployee)) {
    const idx=parseInt(idxStr); const emp=employees[idx];
    for (const day of allWorkDays) {
      if(Math.random()<0.08) continue;
      const task=pick(tasks);
      try { await prisma.timesheet.create({data:{employeeId:emp.id,taskId:task.id,date:new Date(day.getFullYear(),day.getMonth(),day.getDate()),hoursWorked:randInt(6,9),description:pick(['Feature development','Bug fixes','Code review','Testing','Documentation'])}}); tsCount++; } catch(e) {}
    }
  }
  console.log(`✅ ${tsCount} Timesheets`);

  // Project Expenses
  for (const proj of [project1,project2]) {
    for (let i=0;i<5;i++) await prisma.projectExpense.create({data:{projectId:proj.id,description:pick(['Cloud hosting','Software licenses','Design tools','Testing services','Training']),amount:randInt(5000,50000),date:new Date(2026,pick([2,3]),randInt(1,28))}});
  }

  console.log('\n🎉 Seed completed!');
  console.log('  🔐 Admin: admin@hrms.com / admin123');
  console.log('  🔐 Employees: <name>@company.com / employee123');
}

main().catch((e)=>{console.error('Seed error:',e);process.exit(1)}).finally(()=>prisma.$disconnect());