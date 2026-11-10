using System;using System.IO;using System.Text;using System.Runtime.InteropServices;using System.Threading;
class TicketTerminal {
[StructLayout(LayoutKind.Sequential)]struct SA{public int n;public IntPtr sd;public int inherit;}
[StructLayout(LayoutKind.Sequential)]struct SI{public int cb;public IntPtr reserved,desktop,title;public int x,y,xs,ys,xc,yc,fill,flags;public short show,res2;public IntPtr r2,i,o,e;}
[StructLayout(LayoutKind.Sequential)]struct PI{public IntPtr p,t;public int pid,tid;}
[StructLayout(LayoutKind.Explicit,Size=20)]struct Key{[FieldOffset(0)]public short type;[FieldOffset(4)]public int down;[FieldOffset(8)]public short repeat;[FieldOffset(10)]public short vk;[FieldOffset(14)]public char c;}
[DllImport("kernel32")]static extern bool FreeConsole();
[DllImport("kernel32")]static extern bool AllocConsole();
[DllImport("kernel32")]static extern IntPtr GetConsoleWindow();
[DllImport("user32")]static extern bool ShowWindow(IntPtr w,int cmd);
[DllImport("kernel32",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateFileW(string n,uint a,uint sh,ref SA sa,uint d,uint fl,IntPtr t);
[DllImport("kernel32",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcessW(string app,StringBuilder cmd,IntPtr ps,IntPtr ts,bool inh,uint flags,IntPtr env,string cwd,ref SI si,out PI pi);
[DllImport("kernel32",CharSet=CharSet.Unicode)]static extern bool ReadConsoleOutputCharacterW(IntPtr o,[Out] char[] text,uint chars,int pos,out uint n);
[DllImport("kernel32",CharSet=CharSet.Unicode)]static extern bool WriteConsoleInputW(IntPtr i,Key[] keys,uint count,out uint n);
[DllImport("kernel32")]static extern uint WaitForSingleObject(IntPtr h,uint ms);
[DllImport("kernel32")]static extern bool GetExitCodeProcess(IntPtr p,out uint code);
[DllImport("kernel32")]static extern bool TerminateProcess(IntPtr p,uint code);
[DllImport("kernel32")]static extern bool CloseHandle(IntPtr h);
static int Main(string[] args){uint id;if(args.Length!=1||!uint.TryParse(args[0],out id)||id==0)return 2;var log=new StreamWriter(Console.OpenStandardOutput(),new UTF8Encoding(false)){AutoFlush=true};FreeConsole();if(!AllocConsole()){log.WriteLine("Console allocation failed.");return 1;}ShowWindow(GetConsoleWindow(),0);var sa=new SA{n=Marshal.SizeOf(typeof(SA)),inherit=1};
var i=CreateFileW("CONIN$",0xc0000000,3,ref sa,3,0,IntPtr.Zero);var o=CreateFileW("CONOUT$",0xc0000000,3,ref sa,3,0,IntPtr.Zero);
var si=new SI{cb=Marshal.SizeOf(typeof(SI)),flags=256,i=i,o=o,e=o};PI pi;string exe=Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"steam-ticket-generator.exe");if(!CreateProcessW(exe,new StringBuilder("\""+exe+"\""),IntPtr.Zero,IntPtr.Zero,true,0,IntPtr.Zero,Environment.CurrentDirectory,ref si,out pi)){log.WriteLine("Launch failed: "+Marshal.GetLastWin32Error());return 1;}CloseHandle(pi.t);bool sent=false,configConfirmed=false,done=false;var seen=new System.Collections.Generic.HashSet<string>();var deadline=DateTime.UtcNow.AddSeconds(45);
while(true){bool exited=WaitForSingleObject(pi.p,120)==0;var all=new StringBuilder();for(int y=0;y<60;y++){var line=new char[120];uint n;if(ReadConsoleOutputCharacterW(o,line,120,y<<16,out n)){string t=new string(line,0,(int)n).Trim();all.AppendLine(t);if(t.Length>0&&seen.Add(t))log.WriteLine(t);}}string text=all.ToString();string keys="";if(!sent&&text.Contains("Enter the App ID")){sent=true;keys=id.ToString()+"\r";}else if(!configConfirmed&&text.IndexOf("Do you want to create configs.user.ini file?",StringComparison.OrdinalIgnoreCase)>=0){configConfirmed=true;keys="y\r";}else if(!done&&text.Contains("Press Enter to exit")){done=true;keys="\r";}foreach(char c in keys){short vk=(short)(c=='\r'?13:char.ToUpperInvariant(c));var k=new Key{type=1,down=1,repeat=1,vk=vk,c=c};var up=k;up.down=0;uint n;WriteConsoleInputW(i,new[]{k,up},2,out n);}if(exited)break;if(DateTime.UtcNow>deadline){TerminateProcess(pi.p,124);log.WriteLine("Timed out waiting for Steam.");break;}}uint code;GetExitCodeProcess(pi.p,out code);CloseHandle(pi.p);return (int)code;}
}
