import { jest } from '@jest/globals'
import fs from 'fs'
import path from 'path'

export class MockFileSystem {
  // fs module mocks
  existsSync = jest.fn()
  writeFileSync = jest.fn()
  readFileSync = jest.fn()
  mkdirSync = jest.fn()
  statSync = jest.fn()
  unlinkSync = jest.fn()
  readdirSync = jest.fn()
  
  // path module mocks
  join = jest.fn()
  dirname = jest.fn()
  resolve = jest.fn()
  basename = jest.fn()
  extname = jest.fn()
  
  constructor() {
    // Default implementations
    this.existsSync.mockReturnValue(false)
    this.writeFileSync.mockImplementation(() => {})
    this.readFileSync.mockReturnValue('')
    this.mkdirSync.mockImplementation(() => undefined)
    this.statSync.mockReturnValue({ size: 1024 } as any)
    this.unlinkSync.mockImplementation(() => {})
    this.readdirSync.mockReturnValue([])
    
    this.join.mockImplementation((...segments) => segments.join('/'))
    this.dirname.mockImplementation((p) => p.substring(0, p.lastIndexOf('/')) || '/')
    this.resolve.mockImplementation((p) => `/resolved/${p}`)
    this.basename.mockImplementation((p) => p.substring(p.lastIndexOf('/') + 1))
    this.extname.mockImplementation((p) => {
      const lastDot = p.lastIndexOf('.')
      return lastDot > 0 ? p.substring(lastDot) : ''
    })
  }
  
  reset() {
    // Reset all mocks
    this.existsSync.mockReset()
    this.writeFileSync.mockReset()
    this.readFileSync.mockReset()
    this.mkdirSync.mockReset()
    this.statSync.mockReset()
    this.unlinkSync.mockReset()
    this.readdirSync.mockReset()
    
    this.join.mockReset()
    this.dirname.mockReset()
    this.resolve.mockReset()
    this.basename.mockReset()
    this.extname.mockReset()
    
    // Reset to default implementations
    this.existsSync.mockReturnValue(false)
    this.writeFileSync.mockImplementation(() => {})
    this.readFileSync.mockReturnValue('')
    this.mkdirSync.mockImplementation(() => undefined)
    this.statSync.mockReturnValue({ size: 1024 } as any)
    this.unlinkSync.mockImplementation(() => {})
    this.readdirSync.mockReturnValue([])
    
    this.join.mockImplementation((...segments) => segments.join('/'))
    this.dirname.mockImplementation((p) => p.substring(0, p.lastIndexOf('/')) || '/')
    this.resolve.mockImplementation((p) => `/resolved/${p}`)
    this.basename.mockImplementation((p) => p.substring(p.lastIndexOf('/') + 1))
    this.extname.mockImplementation((p) => {
      const lastDot = p.lastIndexOf('.')
      return lastDot > 0 ? p.substring(lastDot) : ''
    })
  }
  
  // Apply mocks to the actual modules (for injection into commands)
  applyToModules() {
    // Replace fs methods
    (fs as any).existsSync = this.existsSync;
    (fs as any).writeFileSync = this.writeFileSync;
    (fs as any).readFileSync = this.readFileSync;
    (fs as any).mkdirSync = this.mkdirSync;
    (fs as any).statSync = this.statSync;
    (fs as any).unlinkSync = this.unlinkSync;
    (fs as any).readdirSync = this.readdirSync;
    
    // Replace path methods
    (path as any).join = this.join;
    (path as any).dirname = this.dirname;
    (path as any).resolve = this.resolve;
    (path as any).basename = this.basename;
    (path as any).extname = this.extname;
  }
  
  // Helper methods for common mock scenarios
  mockFileExists(exists = true) {
    this.existsSync.mockReturnValue(exists)
  }
  
  mockFileWriteSuccess() {
    this.writeFileSync.mockImplementation(() => {})
  }
  
  mockFileWriteError(error: Error) {
    this.writeFileSync.mockImplementation(() => {
      throw error
    })
  }
  
  mockFileReadSuccess(content: string) {
    this.readFileSync.mockReturnValue(content)
  }
  
  mockFileReadError(error: Error) {
    this.readFileSync.mockImplementation(() => {
      throw error
    })
  }
  
  mockDirectoryCreateSuccess() {
    this.mkdirSync.mockImplementation(() => undefined)
  }
  
  mockDirectoryCreateError(error: Error) {
    this.mkdirSync.mockImplementation(() => {
      throw error
    })
  }
  
  mockFileStats(size: number) {
    this.statSync.mockReturnValue({ size } as any)
  }
  
  mockPathJoin(result: string) {
    this.join.mockReturnValue(result)
  }
  
  mockPathDirname(result: string) {
    this.dirname.mockReturnValue(result)
  }
}