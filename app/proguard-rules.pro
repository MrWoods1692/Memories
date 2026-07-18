# NanoHTTPD - keep public API
-keep class fi.iki.elonen.NanoHTTPD { *; }
-keep class fi.iki.elonen.NanoHTTPD$** { *; }
-keep class fi.iki.elonen.NanoHTTPD { protected *; }

# Sardine / WebDAV
-keep class com.github.sardine.** { *; }
-dontwarn com.github.sardine.**

# Apache HTTP (Sardine dependency)
-keep class org.apache.http.** { *; }
-dontwarn org.apache.http.**

# Jackson (Sardine dependency)
-keep class com.fasterxml.jackson.** { *; }
-dontwarn com.fasterxml.jackson.**

# Memories app classes
-keep class com.example.memories.** { *; }

# AndroidX WorkManager
-keep class androidx.work.** { *; }
-dontwarn androidx.work.**

# JSON
-keep class org.json.** { *; }

# General rules
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes InnerClasses
