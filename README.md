# README

打包参考：https://www.jianshu.com/p/ee5ec23d4716

1. main、render process 对 node 模块处理方案
   使用 import x = require("") , 在 main 进程 转化为 const x = require
   使用 import x from "x"，在 render 进程 转化为 const x = require
